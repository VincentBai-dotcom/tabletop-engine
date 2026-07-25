import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

/** Where the binding is written, relative to the project directory. */
export const GAME_LINK_RELATIVE_PATH = join(".tableverse", "game.json");

/** Overrides the file when set, so scripted publishing needs no writable dir. */
export const GAME_ID_ENV_VAR = "TABLEVERSE_GAME_ID";

const GameLinkFileSchema = Type.Object({
  gameId: Type.String({ minLength: 1 }),
});

/**
 * How the id was resolved. `env` beats the file, and the CLI reports which one
 * it used so a stale override is visible rather than silently shadowing a link.
 */
export type GameLinkSource = "env" | "file";

export interface ResolvedGameLink {
  gameId: string;
  source: GameLinkSource;
}

/** The link file exists but does not hold a game id this CLI can read. */
export class GameLinkError extends Error {
  readonly filePath: string;
  readonly detail: string;

  constructor(filePath: string, detail: string, options?: { cause?: unknown }) {
    super(`game_link_invalid:${filePath}:${detail}`, options);
    this.name = "GameLinkError";
    this.filePath = filePath;
    this.detail = detail;
  }
}

/**
 * Resolves which game a directory publishes to: the `TABLEVERSE_GAME_ID`
 * override first, then `.tableverse/game.json`. Returns `null` when neither is
 * present — an unlinked directory, which the caller turns into a first-run
 * create-or-pick prompt. A file that exists but is unreadable or malformed is a
 * `GameLinkError`, not a `null`: the difference between "not linked yet" and
 * "your link is broken" is exactly what the developer needs to hear.
 */
export async function resolveGameLink(options: {
  cwd: string;
  env: Record<string, string | undefined>;
}): Promise<ResolvedGameLink | null> {
  const { cwd, env } = options;

  const override = env[GAME_ID_ENV_VAR]?.trim();
  if (override) {
    return { gameId: override, source: "env" };
  }

  const filePath = join(cwd, GAME_LINK_RELATIVE_PATH);

  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw new GameLinkError(filePath, "could not be read", { cause: error });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new GameLinkError(filePath, "is not valid JSON", { cause: error });
  }

  if (!Value.Check(GameLinkFileSchema, parsed)) {
    throw new GameLinkError(filePath, "does not contain a gameId");
  }

  return { gameId: parsed.gameId, source: "file" };
}

/**
 * Writes the binding `resolveGameLink` reads. Creates `.tableverse/` if needed
 * and never touches anything else — no `.gitignore`, no assumption the project
 * is under version control. The file is CLI-owned state, so it is safe to
 * overwrite: a re-link simply replaces the id.
 */
export async function writeGameLink(options: {
  cwd: string;
  gameId: string;
}): Promise<string> {
  const filePath = join(options.cwd, GAME_LINK_RELATIVE_PATH);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify({ gameId: options.gameId }, null, 2)}\n`,
  );
  return filePath;
}
