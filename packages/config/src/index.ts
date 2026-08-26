import type { AnyGameDefinition } from "@tableverse-kit/engine";

export interface EnginePublishConfig {
  root: string;
}

export interface FrontendPublishConfig {
  root: string;
  buildCommand: string;
  outDir: string;
}

export interface PublishConfig {
  engine: EnginePublishConfig;
  frontend: FrontendPublishConfig;
}

export interface TableverseConfig {
  game: AnyGameDefinition;
  outDir?: string;
  publish?: PublishConfig;
}

export function defineConfig(config: TableverseConfig): TableverseConfig {
  return config;
}
