import { loadConfig, type LoadedCliConfig } from "../load-config.ts";
import {
  createPlatformClient,
  type PlatformClient,
} from "../platform-client.ts";
import {
  resolvePlatformConfig,
  type PlatformConfig,
} from "../platform-config.ts";
import { resolveCredentialsPath } from "../auth/paths.ts";
import { createFileTokenStore, type TokenStore } from "../auth/token-store.ts";
import {
  createInteractiveLinkPrompt,
  type LinkPrompt,
} from "../link/link-prompt.ts";
import { openBrowser, type BrowserOpener } from "../browser.ts";

/** Everything `tvk upload` needs, injected so the flow can be driven in tests. */
export interface UploadContext {
  config: PlatformConfig;
  tokenStore: TokenStore;
  client: PlatformClient;
  now: () => Date;
  cwd: string;
  env: Record<string, string | undefined>;
  loadConfig: (options: {
    cwd: string;
    configPath?: string;
  }) => Promise<LoadedCliConfig>;
  /**
   * Whether the CLI can prompt. False in CI or piped input, where an unlinked
   * project must fail asking for `TABLEVERSE_GAME_ID` rather than block on a
   * prompt no one can answer.
   */
  interactive: boolean;
  /** Runs the create-or-pick picker on an unlinked project's first upload. */
  linkPrompt: LinkPrompt;
  /**
   * Opens the deployment dashboard once the build has started. Best-effort: the
   * URL is printed either way, so a missing browser handler is not an error.
   */
  openBrowser: BrowserOpener;
  /** Progress lines: the target, packaging, and the dashboard hand-off. */
  emit: (line: string) => void;
}

export function createUploadContext(): UploadContext {
  const config = resolvePlatformConfig(process.env);

  return {
    config,
    now: () => new Date(),
    cwd: process.cwd(),
    env: process.env,
    loadConfig,
    tokenStore: createFileTokenStore({
      filePath: resolveCredentialsPath(process.env),
    }),
    client: createPlatformClient({
      apiBaseUrl: config.apiBaseUrl,
      clientId: config.clientId,
      fetch,
    }),
    // Both ends must be a terminal: a prompt is pointless if the answer can't be
    // typed (stdin piped) or seen (stdout redirected).
    interactive: Boolean(process.stdin.isTTY && process.stderr.isTTY),
    linkPrompt: createInteractiveLinkPrompt(),
    openBrowser,
    emit: (line) => process.stderr.write(`${line}\n`),
  };
}
