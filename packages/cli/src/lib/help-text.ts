export function createRootHelpText(): string {
  return ["tabletop-cli", "", "Commands:", "  generate", "  validate"].join(
    "\n",
  );
}

export function createGenerateHelpText(): string {
  return [
    "tabletop-cli generate",
    "",
    "Targets:",
    "  types",
    "  schemas",
    "  protocol",
    "  client-sdk",
  ].join("\n");
}

export function createValidateHelpText(): string {
  return [
    "tabletop-cli validate",
    "",
    "Required flags:",
    "  --game <path>",
  ].join("\n");
}
