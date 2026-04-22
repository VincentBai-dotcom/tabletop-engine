import { cron } from "@elysiajs/cron";
import { Elysia } from "elysia";
import type { DisconnectCleanupService } from "./model";

export function createDisconnectCleanupCron({
  cleanupService,
  pattern,
}: {
  cleanupService: DisconnectCleanupService;
  pattern: string;
}) {
  return new Elysia({ name: "disconnect-cleanup-cron" }).use(
    cron({
      name: "disconnectCleanup",
      pattern,
      async run() {
        try {
          await cleanupService.runOnce();
        } catch (error) {
          console.error("disconnect_cleanup_failed", error);
        }
      },
    }),
  );
}
