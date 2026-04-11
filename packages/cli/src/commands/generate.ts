import { failure, success, type RunResult } from "../lib/command-result.ts";
import { createGenerateHelpText } from "../lib/help-text.ts";
import { isHelpFlag } from "../lib/parse-args.ts";
import { runGenerateSchemasCommand } from "./generate-schemas.ts";

interface GenerateCommandOptions {
  cwd: string;
}

export async function runGenerateCommand(
  args: string[],
  options: GenerateCommandOptions,
): Promise<RunResult> {
  const [target] = args;

  if (!target || isHelpFlag(target)) {
    return success(createGenerateHelpText());
  }

  if (target === "schemas") {
    return runGenerateSchemasCommand(args.slice(1), options);
  }

  if (target === "types" || target === "protocol" || target === "client-sdk") {
    return success(`generate target scaffolded:${target}`);
  }

  return failure(`unknown_generate_target:${target}`);
}
