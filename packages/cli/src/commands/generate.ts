import { failure, success, type RunResult } from "../lib/command-result.ts";
import { createGenerateHelpText } from "../lib/help-text.ts";
import { isHelpFlag } from "../lib/parse-args.ts";

export function runGenerateCommand(args: string[]): RunResult {
  const [target] = args;

  if (!target || isHelpFlag(target)) {
    return success(createGenerateHelpText());
  }

  if (
    target === "types" ||
    target === "schemas" ||
    target === "protocol" ||
    target === "client-sdk"
  ) {
    return success(`generate target scaffolded:${target}`);
  }

  return failure(`unknown_generate_target:${target}`);
}
