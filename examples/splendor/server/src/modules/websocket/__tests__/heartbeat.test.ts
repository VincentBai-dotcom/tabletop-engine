import { describe, expect, it } from "bun:test";
import type { LiveConnection } from "../model";
import { createHeartbeatManager } from "../heartbeat";
import { createLiveConnectionRegistry } from "../registry";

function createHeartbeatConnection(id: string) {
  const calls = {
    ping: 0,
    terminate: 0,
  };
  const connection = {
    id,
    send() {},
    ping() {
      calls.ping += 1;
    },
    terminate() {
      calls.terminate += 1;
    },
  } satisfies LiveConnection;

  return { calls, connection };
}

describe("createHeartbeatManager", () => {
  it("pings active connections and terminates connections that miss a pong", () => {
    const registry = createLiveConnectionRegistry();
    const client = createHeartbeatConnection("conn-1");
    registry.register("session-1", client.connection);
    const terminated: string[] = [];
    const heartbeat = createHeartbeatManager({
      registry,
      intervalMs: 30_000,
      onTerminated(connection) {
        terminated.push(connection.id);
      },
    });

    heartbeat.tick();
    heartbeat.tick();

    expect(client.calls.ping).toBe(1);
    expect(client.calls.terminate).toBe(1);
    expect(terminated).toEqual(["conn-1"]);
  });

  it("clears awaiting pong state when a pong is received", () => {
    const registry = createLiveConnectionRegistry();
    const client = createHeartbeatConnection("conn-1");
    registry.register("session-1", client.connection);
    const heartbeat = createHeartbeatManager({
      registry,
      intervalMs: 30_000,
    });

    heartbeat.tick();
    heartbeat.markPong("conn-1");
    heartbeat.tick();

    expect(client.calls.ping).toBe(2);
    expect(client.calls.terminate).toBe(0);
  });

  it("stops the scheduled heartbeat interval", () => {
    const registry = createLiveConnectionRegistry();
    const scheduled: Array<() => void> = [];
    let clearedTimer: unknown = null;
    const heartbeat = createHeartbeatManager({
      registry,
      intervalMs: 30_000,
      setInterval: (callback, intervalMs) => {
        expect(intervalMs).toBe(30_000);
        scheduled.push(callback);
        return "timer";
      },
      clearInterval: (timer) => {
        clearedTimer = timer;
      },
    });

    const runningHeartbeat = heartbeat.start();
    runningHeartbeat.stop();

    expect(scheduled).toHaveLength(1);
    expect(clearedTimer).toBe("timer");
  });
});
