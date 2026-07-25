import type { AnyGameDefinition } from "@tableverse-kit/engine";
import type { PublishConfig } from "@tableverse-kit/config";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
interface LoadConfigOptions {
  cwd: string;
  configPath?: string;
}

interface RuntimeCliConfig {
  game: AnyGameDefinition;
  outDir?: string;
  publish?: PublishConfig;
}

export interface LoadedCliConfig {
  game: AnyGameDefinition;
  outDir?: string;
  publish?: PublishConfig;
  configFilePath: string;
  configDirectory: string;
}

export async function loadConfig(
  options: LoadConfigOptions,
): Promise<LoadedCliConfig> {
  const configFilePath = options.configPath
    ? resolve(options.cwd, options.configPath)
    : resolve(options.cwd, "tableverse.config.ts");
  const module = (await import(pathToFileURL(configFilePath).href)) as {
    default?: unknown;
  };
  const config = module.default;

  if (!isCliConfig(config)) {
    throw new Error("invalid_cli_config");
  }

  return {
    ...config,
    configFilePath,
    configDirectory: dirname(configFilePath),
  };
}

function isCliConfig(value: unknown): value is RuntimeCliConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!("game" in value) || !isGameDefinition(value.game)) {
    return false;
  }

  if (
    "outDir" in value &&
    value.outDir !== undefined &&
    typeof value.outDir !== "string"
  ) {
    return false;
  }

  return (
    !("publish" in value) ||
    value.publish === undefined ||
    isPublishConfig(value.publish)
  );
}

function isPublishConfig(value: unknown): value is PublishConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const { engine, frontend } = value as Record<string, unknown>;

  const engineOk =
    !!engine &&
    typeof engine === "object" &&
    typeof (engine as Record<string, unknown>).root === "string";

  if (!engineOk || !frontend || typeof frontend !== "object") {
    return false;
  }

  const f = frontend as Record<string, unknown>;

  return (
    typeof f.root === "string" &&
    typeof f.buildCommand === "string" &&
    typeof f.outDir === "string"
  );
}

function isGameDefinition(value: unknown): value is AnyGameDefinition {
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
