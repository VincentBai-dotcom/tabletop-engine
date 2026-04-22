import { describe, expect, it } from "bun:test";
import { createLiveConnectionRegistry } from "../../websocket";
import type { LiveConnection } from "../../websocket";
import { createShutdownService } from "../service";

function createClosableConnection(id: string) {
  const sent: unknown[] = [];
  const closes: Array<{ code?: number; reason?: string }> = [];
  const connection = {
    id,
    send(payload) {
      sent.push(payload);
    },
    close(code, reason) {
      closes.push({ code, reason });
    },
  } satisfies LiveConnection;

  return { closes, connection, sent };
}

describe("createShutdownService", () => {
  it("notifies connections, closes with restart code, stops loops, and stops the server", async () => {
    const registry = createLiveConnectionRegistry();
    const first = createClosableConnection("conn-1");
    const second = createClosableConnection("conn-2");
    const calls: string[] = [];
    registry.register("session-1", first.connection);
    registry.register("session-2", second.connection);

    const service = createShutdownService({
      registry,
      heartbeat: {
        stop() {
          calls.push("heartbeat.stop");
        },
      },
      cleanupCron: {
        stop() {
          calls.push("cleanupCron.stop");
        },
      },
      server: {
        async stop() {
          calls.push("server.stop");
        },
      },
      exitProcess(code) {
        calls.push(`process.exit:${code}`);
      },
      reconnectAfterMs: 1_000,
      closeCode: 1012,
    });

    await service.handleSigterm();

    expect(calls).toEqual([
      "heartbeat.stop",
      "cleanupCron.stop",
      "server.stop",
      "process.exit:0",
    ]);
    expect(first.sent).toEqual([
      { type: "server_restarting", reconnectAfterMs: 1_000 },
    ]);
    expect(second.sent).toEqual([
      { type: "server_restarting", reconnectAfterMs: 1_000 },
    ]);
    expect(first.closes).toEqual([{ code: 1012, reason: "server_restarting" }]);
    expect(second.closes).toEqual([
      { code: 1012, reason: "server_restarting" },
    ]);
  });
});
