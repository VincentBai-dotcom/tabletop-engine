import { resolve } from "node:path";
import type { AnyGameDefinition } from "@tableverse-kit/engine";
import { loadConfig } from "./load-config.ts";

export interface GenerationContext {
  game: AnyGameDefinition;
  configFilePath: string;
  outputDirectory: string;
}

interface CreateGenerationContextOptions {
  cwd: string;
}

export async function createGenerationContext(
  options: CreateGenerationContextOptions,
): Promise<GenerationContext> {
  const config = await loadConfig({ cwd: options.cwd });

  return {
    game: config.game,
    configFilePath: config.configFilePath,
    outputDirectory: config.outDir
      ? resolve(config.configDirectory, config.outDir)
      : resolve(config.configDirectory, "generated"),
  };
}
