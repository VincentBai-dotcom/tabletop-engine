import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import type { DisconnectCleanupService } from "../model";
import { createDisconnectCleanupCron } from "../plugin";

describe("createDisconnectCleanupCron", () => {
  it("registers a named cron job that runs cleanup once per trigger", async () => {
    const calls: string[] = [];
    const cleanupService = {
      async runOnce() {
        calls.push("run");
        return { roomsProcessed: 0, gamesEnded: 0 };
      },
    } satisfies DisconnectCleanupService;

    const app = new Elysia().use(
      createDisconnectCleanupCron({
        cleanupService,
        pattern: "*/5 * * * * *",
      }),
    );

    const job = app.store.cron.disconnectCleanup;
    job.pause();
    await job.trigger();
    job.stop();

    expect(job.getPattern()).toBe("*/5 * * * * *");
    expect(calls).toEqual(["run"]);
  });
});
