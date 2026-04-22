import type { CreateShutdownServiceDeps, ShutdownService } from "./model";

export function createShutdownService({
  registry,
  heartbeat,
  server,
  exitProcess,
  reconnectAfterMs,
  closeCode,
}: CreateShutdownServiceDeps): ShutdownService {
  let shutdownStarted = false;

  return {
    async handleSigterm() {
      if (shutdownStarted) {
        return;
      }
      shutdownStarted = true;

      const connectionCount = registry.getConnections().length;
      console.log("server_shutdown_started", { connectionCount });

      heartbeat.stop();
      console.log("server_shutdown_heartbeat_stopped");

      for (const connection of registry.getConnections()) {
        connection.send({
          type: "server_restarting",
          reconnectAfterMs,
        });
        connection.close?.(closeCode, "server_restarting");
      }
      console.log("server_shutdown_connections_closed", {
        closeCode,
        connectionCount,
        reconnectAfterMs,
      });

      await server.stop();
      console.log("server_shutdown_listener_stopped");

      exitProcess(0);
    },
  };
}
