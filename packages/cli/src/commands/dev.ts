import { failure, success, type RunResult } from "../lib/command-result.ts";
import { createDevHelpText } from "../lib/help-text.ts";
import { isHelpFlag } from "../lib/parse-args.ts";
import { loadConfig } from "../lib/load-config.ts";
import { startDevServer } from "../lib/dev-server/server.ts";

interface DevCommandOptions {
  cwd: string;
}

interface ParsedDevArgs {
  configPath?: string;
  port?: number;
}

export async function runDevCommand(
  args: string[],
  options: DevCommandOptions,
): Promise<RunResult> {
  if (isHelpFlag(args[0])) {
    return success(createDevHelpText());
  }

  try {
    const parsed = parseDevArgs(args);
    const config = await loadConfig({
      cwd: options.cwd,
      configPath: parsed.configPath,
    });
    const handle = await startDevServer(config.game, { port: parsed.port });
    console.log(`tvk dev listening on ${handle.url}`);
    await new Promise<void>(() => {});
    return success("");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "dev_command_failed",
    );
  }
}

function parseDevArgs(args: string[]): ParsedDevArgs {
  const parsed: ParsedDevArgs = {};

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];

    if (flag === "--config" && value) {
      parsed.configPath = value;
      index += 1;
    } else if (flag === "--port" && value) {
      const port = Number.parseInt(value, 10);
      if (Number.isNaN(port)) {
        throw new Error(`invalid_port:${value}`);
      }
      parsed.port = port;
      index += 1;
    } else {
      throw new Error(`unknown_flag:${flag}`);
    }
  }

  return parsed;
}
