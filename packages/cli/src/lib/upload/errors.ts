import { GameLinkError, type GameLinkSource } from "../link/game-link.ts";
import { SourcePackagingError } from "../packaging/tarball.ts";
import { KNOWN_LOCKFILES } from "../packaging/lockfile.ts";
import type { PlatformConfig } from "../platform-config.ts";
import {
  ArtifactUploadError,
  PlatformRequestError,
  PlatformResponseError,
} from "../platform-client.ts";

/** Which half of the publish a pre-flight check was about. */
export type SourceLabel = "engine" | "frontend";

/** A configured source directory does not exist. */
export class MissingSourceRootError extends Error {
  constructor(
    readonly label: SourceLabel,
    readonly root: string,
  ) {
    super(`missing_source_root:${label}:${root}`);
    this.name = "MissingSourceRootError";
  }
}

/** A source directory has no lockfile, so its version could not be rebuilt. */
export class MissingLockfileError extends Error {
  constructor(
    readonly label: SourceLabel,
    readonly root: string,
  ) {
    super(`missing_lockfile:${label}:${root}`);
    this.name = "MissingLockfileError";
  }
}

/**
 * The linked game exists behind an account this one cannot reach — the usual
 * cause is a copied directory carrying someone else's `game.json`, or a stale
 * `TABLEVERSE_GAME_ID`. Raised from a 403/404 on `GET /games/:id` so it reads as
 * "re-link", not a raw status. `source` says which of the two to advise fixing.
 */
export class InaccessibleGameError extends Error {
  constructor(
    readonly gameId: string,
    readonly source: GameLinkSource,
  ) {
    super(`inaccessible_game:${source}:${gameId}`);
    this.name = "InaccessibleGameError";
  }
}

/**
 * Turns the errors `tvk upload` can fail with into a printable sentence. The
 * internal identifiers these carry (`missing_lockfile:engine:…`,
 * `artifact_upload_failed:403`) are for us; the developer gets the next action.
 */
export function describeUploadError(
  error: unknown,
  config: PlatformConfig,
): string {
  if (error instanceof MissingSourceRootError) {
    return [
      `The ${error.label} source directory does not exist:`,
      `  ${error.root}`,
      "Check the `publish` block in tableverse.config.ts.",
    ].join("\n");
  }

  if (error instanceof MissingLockfileError) {
    return [
      `The ${error.label} source at ${error.root} has no lockfile.`,
      `A version must be rebuildable, so one of ${KNOWN_LOCKFILES.join(", ")} is required.`,
      "Install dependencies to generate one, then run `tvk upload` again.",
    ].join("\n");
  }

  if (error instanceof SourcePackagingError) {
    if (error.reason === "secret_files") {
      return [
        "Refusing to publish: the source contains private-key or credential files.",
        ...error.files.map((file) => `  ${file}`),
        "Published source is retained, so move these out of the source root before publishing.",
      ].join("\n");
    }
    return `The source directory ${error.root} is empty; there is nothing to publish.`;
  }

  if (error instanceof InaccessibleGameError) {
    if (error.source === "env") {
      return [
        `The game id in TABLEVERSE_GAME_ID (${error.gameId}) is not one you can access.`,
        "Set it to a game you own, or unset it and run `tvk upload` to link a new one.",
      ].join("\n");
    }
    return [
      "This project is linked to a game you do not have access to.",
      "Delete .tableverse/game.json and run `tvk upload` again to publish it as your own.",
    ].join("\n");
  }

  if (error instanceof GameLinkError) {
    return [
      `This project's link is broken — ${error.detail}:`,
      `  ${error.filePath}`,
      "Delete it and run `tvk upload` again to re-link.",
    ].join("\n");
  }

  if (error instanceof ArtifactUploadError) {
    if (error.status === 403) {
      return "Upload window expired. Run `tvk upload` to try again.";
    }
    return `Uploading the source failed (HTTP ${error.status}). Run \`tvk upload\` to try again.`;
  }

  if (error instanceof PlatformResponseError) {
    return [
      `The platform at ${config.apiBaseUrl} returned a response tvk did not understand (${error.endpoint}).`,
      "Update tvk to the latest version; if it still happens, please report it.",
    ].join("\n");
  }

  if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
    return [
      `Could not reach the platform at ${config.apiBaseUrl}.`,
      "Check your network connection, or set TABLEVERSE_API_URL if you meant a different deployment.",
    ].join("\n");
  }

  if (error instanceof PlatformRequestError) {
    if (error.status >= 500) {
      return `The platform returned an error (HTTP ${error.status}). Try again shortly.`;
    }
    return `The platform rejected the request to ${error.endpoint} (HTTP ${error.status}).`;
  }

  return error instanceof Error ? error.message : String(error);
}
