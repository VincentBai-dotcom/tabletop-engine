import type { LiveConnection, LiveConnectionRegistry } from "./model";

type IntervalHandle = ReturnType<typeof setInterval>;
type ScheduleInterval = (callback: () => void, intervalMs: number) => unknown;
type ClearScheduledInterval = (timer: unknown) => void;

export interface HeartbeatManager {
  tick(): void;
  markPong(connectionId: string): void;
  start(): { stop(): void };
}

export function createHeartbeatManager({
  registry,
  intervalMs,
  onTerminated,
  setInterval: scheduleInterval = setInterval,
  clearInterval: clearScheduledInterval = (timer) =>
    clearInterval(timer as IntervalHandle),
}: {
  registry: LiveConnectionRegistry;
  intervalMs: number;
  onTerminated?: (connection: LiveConnection) => void;
  setInterval?: ScheduleInterval;
  clearInterval?: ClearScheduledInterval;
}): HeartbeatManager {
  const awaitingPong = new Set<string>();

  function terminate(connection: LiveConnection) {
    awaitingPong.delete(connection.id);
    connection.terminate?.();
    onTerminated?.(connection);
  }

  function tick() {
    for (const connection of registry.getConnections()) {
      if (awaitingPong.has(connection.id)) {
        terminate(connection);
        continue;
      }

      awaitingPong.add(connection.id);
      connection.ping?.();
    }
  }

  return {
    tick,
    markPong(connectionId) {
      awaitingPong.delete(connectionId);
    },
    start() {
      const timer = scheduleInterval(tick, intervalMs);

      return {
        stop() {
          clearScheduledInterval(timer);
        },
      };
    },
  };
}
