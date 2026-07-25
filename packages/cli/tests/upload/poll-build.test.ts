import { describe, expect, it, vi } from "vitest";
import type { BuildResponse } from "../../src/lib/api/builds.ts";
import { pollBuild } from "../../src/lib/upload/poll-build.ts";

function build(status: BuildResponse["status"]): BuildResponse {
  return { buildId: "b1", status, steps: [], error: null, logsUrl: null };
}

/** A clock that advances by `intervalMs` every time the loop sleeps. */
function fakeClock(intervalMs: number) {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    intervalMs,
  };
}

describe("pollBuild", () => {
  it("returns ready as soon as the build is ready, without sleeping", async () => {
    const clock = fakeClock(2000);
    const sleep = vi.fn(clock.sleep);

    const outcome = await pollBuild({
      fetch: async () => build("ready"),
      sleep,
      now: clock.now,
      intervalMs: clock.intervalMs,
      timeoutMs: 30_000,
    });

    expect(outcome.status).toBe("ready");
    expect(sleep).not.toHaveBeenCalled();
  });

  it("polls through building until ready", async () => {
    const clock = fakeClock(2000);
    const states: BuildResponse["status"][] = ["queued", "building", "ready"];
    let i = 0;

    const outcome = await pollBuild({
      fetch: async () => build(states[i++]!),
      sleep: clock.sleep,
      now: clock.now,
      intervalMs: clock.intervalMs,
      timeoutMs: 30_000,
    });

    expect(outcome.status).toBe("ready");
    expect(i).toBe(3);
  });

  it("returns failed and stops", async () => {
    const clock = fakeClock(2000);
    const outcome = await pollBuild({
      fetch: async () => build("failed"),
      sleep: clock.sleep,
      now: clock.now,
      intervalMs: clock.intervalMs,
      timeoutMs: 30_000,
    });

    expect(outcome.status).toBe("failed");
  });

  it("times out on a build that never leaves queued, carrying the last state", async () => {
    const clock = fakeClock(2000);
    const fetch = vi.fn(async () => build("queued"));

    const outcome = await pollBuild({
      fetch,
      sleep: clock.sleep,
      now: clock.now,
      intervalMs: clock.intervalMs,
      timeoutMs: 6_000,
    });

    expect(outcome.status).toBe("timed_out");
    expect(outcome.build.status).toBe("queued");
    // t = 0, 2000, 4000, 6000 -> the 6000 tick hits the deadline and returns.
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("emits every update so the caller can stream steps", async () => {
    const clock = fakeClock(2000);
    const seen: string[] = [];
    const states: BuildResponse["status"][] = ["queued", "ready"];
    let i = 0;

    await pollBuild({
      fetch: async () => build(states[i++]!),
      onUpdate: (b) => seen.push(b.status),
      sleep: clock.sleep,
      now: clock.now,
      intervalMs: clock.intervalMs,
      timeoutMs: 30_000,
    });

    expect(seen).toEqual(["queued", "ready"]);
  });
});
