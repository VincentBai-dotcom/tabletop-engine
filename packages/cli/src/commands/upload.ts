import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { UploadContext } from "../lib/upload/context.ts";
import type { GameResponse } from "../lib/api/games.ts";
import { loadSession } from "../lib/auth/session.ts";
import {
  resolveGameLink,
  writeGameLink,
  type ResolvedGameLink,
} from "../lib/link/game-link.ts";
import { findLockfile } from "../lib/packaging/lockfile.ts";
import { packSource } from "../lib/packaging/tarball.ts";
import { pollBuild } from "../lib/upload/poll-build.ts";
import {
  InaccessibleGameError,
  MissingLockfileError,
  MissingSourceRootError,
  describeUploadError,
  type SourceLabel,
} from "../lib/upload/errors.ts";
import { PlatformRequestError } from "../lib/platform-client.ts";
import { failure, success, type RunResult } from "../lib/command-result.ts";
import { createUploadHelpText } from "../lib/help-text.ts";
import { isHelpFlag, parseCommandArguments } from "../lib/parse-args.ts";
import type { PublishConfig } from "@tableverse-kit/config";

const LOGGED_OUT_MESSAGE = "Not logged in. Run `tvk login`.";
const EXPIRED_MESSAGE = "Session expired. Run `tvk login`.";

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Resolves one source root to an absolute path and proves it is rebuildable. */
async function resolveSourceRoot(
  label: SourceLabel,
  root: string,
  configDirectory: string,
): Promise<string> {
  const absolute = resolve(configDirectory, root);

  if (!(await directoryExists(absolute))) {
    throw new MissingSourceRootError(label, absolute);
  }
  if (!(await findLockfile(absolute))) {
    throw new MissingLockfileError(label, absolute);
  }

  return absolute;
}

/** Confirms a linked id resolves and the account can reach it. */
async function resolveLinkedGame(
  ctx: UploadContext,
  accessToken: string,
  link: ResolvedGameLink,
): Promise<GameResponse> {
  try {
    return await ctx.client.getGame({ accessToken, gameId: link.gameId });
  } catch (error) {
    if (
      error instanceof PlatformRequestError &&
      (error.status === 403 || error.status === 404)
    ) {
      throw new InaccessibleGameError(link.gameId, link.source);
    }
    throw error;
  }
}

/**
 * First-run link: on an unlinked project, offer the account's games to pick from
 * or create a new one, then write the binding. Never silent — a missing link is
 * indistinguishable from a copy whose binding was lost, so creating one is only
 * ever an explicit choice made here.
 */
async function establishFirstRunLink(
  ctx: UploadContext,
  accessToken: string,
  defaultName: string,
): Promise<GameResponse> {
  const { games } = await ctx.client.listGames({ accessToken });
  const decision = await ctx.linkPrompt({ games, defaultName });

  let game: GameResponse;
  if (decision.action === "create") {
    game = await ctx.client.createGame({ accessToken, name: decision.name });
  } else {
    game =
      games.find((candidate) => candidate.id === decision.gameId) ??
      (await ctx.client.getGame({ accessToken, gameId: decision.gameId }));
  }

  try {
    await writeGameLink({ cwd: ctx.cwd, gameId: game.id });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // The game now exists on the platform but the link was not saved. Point at
    // TABLEVERSE_GAME_ID so a retry targets it instead of prompting to create a
    // second game — the duplicate the first-run design exists to prevent.
    throw new Error(
      decision.action === "create"
        ? `Created game ${game.name} (${game.id}), but saving the link failed: ${detail}\n` +
            `Set TABLEVERSE_GAME_ID=${game.id} before re-running \`tvk upload\`, or a retry will create a duplicate game.`
        : `Could not save the project link: ${detail}\n` +
            `Set TABLEVERSE_GAME_ID=${game.id}, or fix the directory and re-run \`tvk upload\`.`,
    );
  }
  ctx.emit(
    decision.action === "create"
      ? `Created game ${game.name} (${game.id}) and linked this directory.`
      : `Linked this directory to ${game.name} (${game.id}).`,
  );
  return game;
}

export async function runUploadCommand(
  args: string[],
  ctx: UploadContext,
): Promise<RunResult> {
  if (isHelpFlag(args[0])) {
    return success(createUploadHelpText());
  }

  let configPath: string | undefined;
  try {
    configPath = parseCommandArguments(args).configPath;
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }

  let tempDir: string | undefined;
  try {
    const session = await loadSession({
      apiBaseUrl: ctx.config.apiBaseUrl,
      tokenStore: ctx.tokenStore,
      client: ctx.client,
      now: ctx.now,
    });
    if (session.status === "logged_out") {
      return failure(LOGGED_OUT_MESSAGE);
    }
    if (session.status === "expired") {
      return failure(EXPIRED_MESSAGE);
    }
    const { accessToken } = session;

    const config = await ctx.loadConfig({ cwd: ctx.cwd, configPath });
    const publish: PublishConfig | undefined = config.publish;
    if (!publish) {
      return failure(
        "This project has no `publish` config. Add a `publish` block to tableverse.config.ts before uploading.",
      );
    }

    // Pre-flight the filesystem before any network call: a missing source root
    // or lockfile is the developer's to fix, and failing here spends nothing.
    const engineRoot = await resolveSourceRoot(
      "engine",
      publish.engine.root,
      config.configDirectory,
    );
    const frontendRoot = await resolveSourceRoot(
      "frontend",
      publish.frontend.root,
      config.configDirectory,
    );

    // Resolve which game this publishes to. A linked project confirms access to
    // its id; an unlinked one prompts to create or pick on its first upload —
    // or, with no terminal to prompt at, stops and asks for an explicit id
    // rather than silently creating a duplicate game.
    const link = await resolveGameLink({ cwd: ctx.cwd, env: ctx.env });
    let game: GameResponse;
    if (link) {
      game = await resolveLinkedGame(ctx, accessToken, link);
    } else if (!ctx.interactive) {
      return failure(
        [
          "This project is not linked to a game, and there is no terminal to choose one.",
          "Set TABLEVERSE_GAME_ID to publish to a specific game.",
        ].join("\n"),
      );
    } else {
      game = await establishFirstRunLink(ctx, accessToken, config.game.name);
    }

    // Show the target before packaging: for a linked project this is the check
    // that catches a copied directory, which authorization cannot see.
    ctx.emit(`Publishing to ${game.name} (${game.id})`);

    tempDir = await mkdtemp(join(tmpdir(), "tvk-upload-"));
    ctx.emit("Packaging source…");
    const engineSource = await packSource({
      root: engineRoot,
      outFile: join(tempDir, "engine-source.tar.gz"),
    });
    const frontendSource = await packSource({
      root: frontendRoot,
      outFile: join(tempDir, "frontend-source.tar.gz"),
      excludeDirs: [publish.frontend.outDir],
    });

    // Local env files never leave the machine; name them so a skipped `.env`
    // reads as intended rather than as a silently lost file.
    const dropped = [
      ...engineSource.droppedFiles.map((file) => `engine/${file}`),
      ...frontendSource.droppedFiles.map((file) => `frontend/${file}`),
    ];
    if (dropped.length > 0) {
      ctx.emit(`Skipped local env files: ${dropped.join(", ")}`);
    }

    const version = await ctx.client.createVersion({
      accessToken,
      gameId: game.id,
      engineSourceSha256: engineSource.sha256,
      engineSourceSizeBytes: engineSource.sizeBytes,
      frontendSourceSha256: frontendSource.sha256,
      frontendSourceSizeBytes: frontendSource.sizeBytes,
    });

    // The two uploads are independent, so run them together: it roughly halves
    // upload time and narrows the window against the presigned URLs' expiry.
    ctx.emit("Uploading source…");
    const uploadArtifact = async (
      target: (typeof version.putUrls)["engineSource"],
      path: string,
    ) => ctx.client.uploadArtifact({ target, body: await readFile(path) });
    await Promise.all([
      uploadArtifact(version.putUrls.engineSource, engineSource.path),
      uploadArtifact(version.putUrls.frontendSource, frontendSource.path),
    ]);

    const { buildId } = await ctx.client.startBuild({
      accessToken,
      versionId: version.versionId,
    });

    const emitted = new Set<string>();
    const outcome = await pollBuild({
      fetch: () => ctx.client.getBuild({ accessToken, buildId }),
      onUpdate: (build) => {
        for (const step of build.steps) {
          if (step.status === "ready" && !emitted.has(step.name)) {
            emitted.add(step.name);
            ctx.emit(`${step.name} ✓`);
          }
        }
      },
      sleep: ctx.sleep,
      now: () => ctx.now().getTime(),
      intervalMs: ctx.pollIntervalMs,
      timeoutMs: ctx.pollTimeoutMs,
    });

    if (outcome.status === "ready") {
      return success(`Published ${game.name}@v${version.versionNumber}`);
    }

    if (outcome.status === "failed") {
      const failingStep = outcome.build.steps.find(
        (step) => step.status === "failed",
      );
      const lines = [
        failingStep
          ? `Build failed at step "${failingStep.name}".`
          : "Build failed.",
      ];
      if (outcome.build.error) {
        lines.push(outcome.build.error);
      }
      if (outcome.build.logsUrl) {
        lines.push(`Logs: ${outcome.build.logsUrl}`);
      }
      return failure(lines.join("\n"));
    }

    const seconds = Math.round(ctx.pollTimeoutMs / 1000);
    return failure(
      [
        `Build ${buildId} is still ${outcome.build.status} after ${seconds}s.`,
        "No build runner may be configured yet. Re-run `tvk upload` or check back later;",
        "raise TABLEVERSE_BUILD_POLL_TIMEOUT_MS to wait longer.",
      ].join("\n"),
    );
  } catch (error) {
    return failure(describeUploadError(error, ctx.config));
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
