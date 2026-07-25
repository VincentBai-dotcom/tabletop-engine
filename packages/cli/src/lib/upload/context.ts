import { setTimeout as delay } from "node:timers/promises";
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

/** Everything `tvk upload` needs, injected so the flow can be driven in tests. */
export interface UploadContext {
  config: PlatformConfig;
  tokenStore: TokenStore;
  client: PlatformClient;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  cwd: string;
  env: Record<string, string | undefined>;
  loadConfig: (options: {
    cwd: string;
    configPath?: string;
  }) => Promise<LoadedCliConfig>;
  /** Overall deadline for build polling, then the per-tick interval. */
  pollTimeoutMs: number;
  pollIntervalMs: number;
  /**
   * Whether the CLI can prompt. False in CI or piped input, where an unlinked
   * project must fail asking for `TABLEVERSE_GAME_ID` rather than block on a
   * prompt no one can answer.
   */
  interactive: boolean;
  /** Runs the create-or-pick picker on an unlinked project's first upload. */
  linkPrompt: LinkPrompt;
  /** Progress lines: the target, packaging, and streamed build steps. */
  emit: (line: string) => void;
}

const DEFAULT_POLL_INTERVAL_MS = 2_000;
// Short by default: with no build runner deployed a build stays queued, so a
// long wait would only be a long hang. `TABLEVERSE_BUILD_POLL_TIMEOUT_MS` raises
// it once real builds, which take minutes, are in play.
const DEFAULT_POLL_TIMEOUT_MS = 30_000;

function positiveIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createUploadContext(): UploadContext {
  const config = resolvePlatformConfig(process.env);

  return {
    config,
    now: () => new Date(),
    sleep: (ms) => delay(ms),
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
    pollIntervalMs: positiveIntEnv(
      process.env.TABLEVERSE_BUILD_POLL_INTERVAL_MS,
      DEFAULT_POLL_INTERVAL_MS,
    ),
    pollTimeoutMs: positiveIntEnv(
      process.env.TABLEVERSE_BUILD_POLL_TIMEOUT_MS,
      DEFAULT_POLL_TIMEOUT_MS,
    ),
    // Both ends must be a terminal: a prompt is pointless if the answer can't be
    // typed (stdin piped) or seen (stdout redirected).
    interactive: Boolean(process.stdin.isTTY && process.stderr.isTTY),
    linkPrompt: createInteractiveLinkPrompt(),
    emit: (line) => process.stderr.write(`${line}\n`),
  };
}
