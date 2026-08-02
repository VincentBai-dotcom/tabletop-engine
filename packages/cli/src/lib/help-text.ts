export function createRootHelpText(): string {
  return [
    "tvk",
    "",
    "Commands:",
    "  generate",
    "  validate",
    "  login",
    "  logout",
    "  whoami",
    "  upload",
  ].join("\n");
}

export function createGenerateHelpText(): string {
  return [
    "tvk generate",
    "",
    "Targets:",
    "  client-sdk",
    "",
    "Optional flags:",
    "  --config <path>",
    "  --outDir <path>",
  ].join("\n");
}

export function createValidateHelpText(): string {
  return ["tvk validate", "", "Optional flags:", "  --config <path>"].join(
    "\n",
  );
}

const ENVIRONMENT_HELP = [
  "Environment:",
  "  TABLEVERSE_API_URL   platform-api base URL (default https://api-dev.tableverse.io)",
  "  TABLEVERSE_WEB_URL   platform-web base URL (default https://dev.tableverse.io)",
];

export function createLoginHelpText(): string {
  return [
    "tvk login",
    "",
    "Authenticate with the Tableverse platform in your browser.",
    "Credentials are stored per API base URL, so separate environments do not",
    "overwrite each other.",
    "",
    ...ENVIRONMENT_HELP,
  ].join("\n");
}

export function createLogoutHelpText(): string {
  return [
    "tvk logout",
    "",
    "Revoke the stored refresh token and remove local credentials.",
    "",
    ...ENVIRONMENT_HELP,
  ].join("\n");
}

export function createWhoamiHelpText(): string {
  return [
    "tvk whoami",
    "",
    "Print the currently logged-in account.",
    "",
    ...ENVIRONMENT_HELP,
  ].join("\n");
}

export function createUploadHelpText(): string {
  return [
    "tvk upload",
    "",
    "Package the engine and frontend source and publish a new game version.",
    "On the first upload of an unlinked project, you are asked to create a new",
    "game or pick an existing one; the choice is saved to .tableverse/game.json.",
    "In a non-interactive shell, set TABLEVERSE_GAME_ID instead.",
    "",
    "Optional flags:",
    "  --config <path>",
    "",
    ...ENVIRONMENT_HELP,
    "  TABLEVERSE_GAME_ID                 publish to this game id, overriding the link",
  ].join("\n");
}
