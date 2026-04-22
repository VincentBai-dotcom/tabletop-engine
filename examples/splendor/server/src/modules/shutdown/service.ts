import type { CreateShutdownServiceDeps, ShutdownService } from "./model";

export function createShutdownService({
  registry,
  heartbeat,
  cleanupCron,
  server,
  exitProcess,
  reconnectAfterMs,
  closeCode,
}: CreateShutdownServiceDeps): ShutdownService {
  return {
    async handleSigterm() {
      heartbeat.stop();
      cleanupCron?.stop();

      for (const connection of registry.getConnections()) {
        connection.send({
          type: "server_restarting",
          reconnectAfterMs,
        });
        connection.close?.(closeCode, "server_restarting");
      }

      await server.stop();
      exitProcess(0);
    },
  };
}
