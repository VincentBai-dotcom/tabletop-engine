import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { failure, success, type RunResult } from "../lib/command-result.ts";
import { createDevHelpText } from "../lib/help-text.ts";
import { isHelpFlag } from "../lib/parse-args.ts";
import { loadConfig } from "../lib/load-config.ts";
import { startDevServer } from "../lib/dev-server/server.ts";

interface DevCommandOptions {
  cwd: string;
}

export interface DevCommandRuntime {
  startServer: typeof startDevServer;
  runFrontend(root: string): Promise<number>;
  emit(line: string): void;
}

interface ParsedDevArgs {
  port?: number;
}

export const FRONTEND_DEV_COMMAND: Readonly<{
  executable: string;
  args: readonly string[];
}> = {
  executable: "npm",
  args: ["run", "dev"],
};

export async function runDevCommand(
  args: string[],
  options: DevCommandOptions,
  runtime: DevCommandRuntime = defaultRuntime,
): Promise<RunResult> {
  if (isHelpFlag(args[0])) {
    return success(createDevHelpText());
  }

  try {
    const parsed = parseDevArgs(args);
    const config = await loadConfig({ cwd: options.cwd });
    if (!config.publish) {
      return failure(
        "tvk dev needs publish.frontend.root in tableverse.config.ts.",
      );
    }

    const frontendRoot = resolve(
      config.configDirectory,
      config.publish.frontend.root,
    );
    const server = await runtime.startServer(config.game, {
      port: parsed.port,
    });

    try {
      runtime.emit(`tvk dev server listening on ${server.url}`);
      runtime.emit(`tvk dev starting frontend in ${frontendRoot}`);
      const exitCode = await runtime.runFrontend(frontendRoot);
      return exitCode === 0
        ? success("")
        : failure(`frontend_dev_exited:${exitCode}`);
    } finally {
      await server.close();
    }
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

    if (flag === "--port" && value) {
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

const defaultRuntime: DevCommandRuntime = {
  startServer: startDevServer,
  runFrontend: (root) =>
    new Promise<number>((resolveExit, reject) => {
      const child = spawn(
        FRONTEND_DEV_COMMAND.executable,
        FRONTEND_DEV_COMMAND.args,
        {
          cwd: root,
          stdio: "inherit",
        },
      );
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        resolveExit(code ?? (signal ? 1 : 0));
      });
    }),
  emit: (line) => console.log(line),
};
