import { failure, success, type RunResult } from "../lib/command-result.ts";
import { createValidateHelpText } from "../lib/help-text.ts";
import { isHelpFlag } from "../lib/parse-args.ts";

export function runValidateCommand(args: string[]): RunResult {
  const [firstArg] = args;

  if (!firstArg || isHelpFlag(firstArg)) {
    return success(createValidateHelpText());
  }

  return failure(`unknown_validate_argument:${firstArg}`);
}
