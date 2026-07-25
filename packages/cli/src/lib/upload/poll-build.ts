import type { BuildResponse } from "../api/builds.ts";

export type PollOutcome =
  | { status: "ready"; build: BuildResponse }
  | { status: "failed"; build: BuildResponse }
  | { status: "timed_out"; build: BuildResponse };

export interface PollBuildDeps {
  /** Fetches the current build state; called once immediately, then per tick. */
  fetch: () => Promise<BuildResponse>;
  /** Invoked after every fetch so the caller can stream step progress. */
  onUpdate?: (build: BuildResponse) => void;
  sleep: (ms: number) => Promise<void>;
  /** Monotonic-ish millis; the timeout is measured against it. */
  now: () => number;
  intervalMs: number;
  timeoutMs: number;
}

/**
 * Polls a build to a terminal state. Returns `timed_out` carrying the last
 * build seen when the deadline passes before `ready`/`failed` — which, with no
 * build runner deployed, is the expected end: the build stays `queued` and the
 * CLI reports that rather than hanging. The first fetch is immediate so a build
 * that is already terminal returns without sleeping.
 */
export async function pollBuild(deps: PollBuildDeps): Promise<PollOutcome> {
  const { fetch, onUpdate, sleep, now, intervalMs, timeoutMs } = deps;
  const deadline = now() + timeoutMs;

  for (;;) {
    const build = await fetch();
    onUpdate?.(build);

    if (build.status === "ready") {
      return { status: "ready", build };
    }
    if (build.status === "failed") {
      return { status: "failed", build };
    }

    if (now() >= deadline) {
      return { status: "timed_out", build };
    }
    await sleep(intervalMs);
  }
}
