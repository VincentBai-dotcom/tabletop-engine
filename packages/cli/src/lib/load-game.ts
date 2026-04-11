import type { GameDefinition } from "tabletop-engine";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

interface LoadGameOptions {
  gamePath: string;
  exportName?: string;
  cwd: string;
}

type GameFactory = (options?: unknown) => GameDefinition;

export async function loadGame(
  options: LoadGameOptions,
): Promise<GameDefinition> {
  const resolvedPath = resolve(options.cwd, options.gamePath);
  const module = (await import(pathToFileURL(resolvedPath).href)) as Record<
    string,
    unknown
  >;
  const entry = resolveGameEntry(module, options.exportName);

  if (isGameDefinition(entry)) {
    return entry;
  }

  if (typeof entry === "function") {
    const built = buildGameFromFactory(entry as GameFactory);

    if (isGameDefinition(built)) {
      return built;
    }
  }

  throw new Error(`invalid_game_export:${options.exportName ?? "default"}`);
}

function resolveGameEntry(
  module: Record<string, unknown>,
  exportName?: string,
): unknown {
  if (exportName) {
    return module[exportName];
  }

  if (module.default !== undefined) {
    return module.default;
  }

  const conventionalEntries = Object.entries(module).filter(([name, value]) => {
    return typeof value === "function" && /^create.+Game$/u.test(name);
  });

  if (conventionalEntries.length === 1) {
    return conventionalEntries[0]?.[1];
  }

  throw new Error("game_export_not_found");
}

function buildGameFromFactory(factory: GameFactory): unknown {
  if (factory.length === 0) {
    return factory();
  }

  return factory({
    playerIds: ["player-1", "player-2"],
  });
}

function isGameDefinition(value: unknown): value is GameDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "name" in value &&
    "commands" in value &&
    "canonicalGameStateSchema" in value &&
    "runtimeStateSchema" in value
  );
}
