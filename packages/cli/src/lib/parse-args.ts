export function isHelpFlag(value: string | undefined): boolean {
  return value === "--help" || value === "-h";
}

export function rejectCommandArguments(args: string[]): void {
  const argument = args[0];
  if (!argument) {
    return;
  }
  if (argument.startsWith("--")) {
    throw new Error(`unknown_flag:${argument}`);
  }
  throw new Error(`unexpected_positional_argument:${argument}`);
}
