export function isHelpFlag(value: string | undefined): boolean {
  return value === "--help" || value === "-h";
}
