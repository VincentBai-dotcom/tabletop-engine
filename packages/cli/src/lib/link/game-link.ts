import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const GAME_LINK_RELATIVE_PATH = join(".tableverse", "game.json");

export const GAME_ID_ENV_VAR = "TABLEVERSE_GAME_ID";

const GameLinkFileSchema = Type.Object({
  gameId: Type.String({ minLength: 1 }),
});

export type GameLinkSource = "env" | "file";

export interface ResolvedGameLink {
  gameId: string;
  source: GameLinkSource;
}

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

export async function resolveGameLink(options: {
  projectRoot: string;
  env: Record<string, string | undefined>;
}): Promise<ResolvedGameLink | null> {
  const { projectRoot, env } = options;

  const override = env[GAME_ID_ENV_VAR]?.trim();
  if (override) {
    return { gameId: override, source: "env" };
  }

  const filePath = join(projectRoot, GAME_LINK_RELATIVE_PATH);

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

export async function writeGameLink(options: {
  projectRoot: string;
  gameId: string;
}): Promise<string> {
  const filePath = join(options.projectRoot, GAME_LINK_RELATIVE_PATH);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify({ gameId: options.gameId }, null, 2)}\n`,
  );
  return filePath;
}
