import type { GameDefinition } from "tabletop-engine";
import { resolve } from "node:path";
import { loadGame } from "./load-game.ts";
import type { ParsedCommandArguments } from "./parse-args.ts";

export interface GenerationContext {
  game: GameDefinition;
  gameModulePath: string;
  outputDirectory: string;
}

interface CreateGenerationContextOptions {
  cwd: string;
}

export async function createGenerationContext(
  args: ParsedCommandArguments,
  options: CreateGenerationContextOptions,
): Promise<GenerationContext> {
  return {
    game: await loadGame({
      gamePath: args.gamePath,
      exportName: args.exportName,
      cwd: options.cwd,
    }),
    gameModulePath: resolve(options.cwd, args.gamePath),
    outputDirectory: args.outDir
      ? resolve(options.cwd, args.outDir)
      : resolve(options.cwd, "generated"),
  };
}
