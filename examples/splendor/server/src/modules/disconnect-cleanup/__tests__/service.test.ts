import { describe, expect, it } from "bun:test";
import type { GameSessionService } from "../../game-session";
import type { RoomService } from "../../room";
import type { LiveNotifier } from "../../websocket";
import { createDisconnectCleanupService } from "../service";

function createFakeRoomService() {
  const calls = {
    cleanupExpiredDisconnects: [] as unknown[],
  };
  const service = {
    async createRoom() {
      throw new Error("not used");
    },
    async joinRoom() {
      throw new Error("not used");
    },
    async setReady() {
      throw new Error("not used");
    },
    async markDisconnected() {
      throw new Error("not used");
    },
    async markReconnected() {
      throw new Error("not used");
    },
    async cleanupExpiredDisconnects(input) {
      calls.cleanupExpiredDisconnects.push(input);
      return 1;
    },
    async leaveRoom() {
      throw new Error("not used");
    },
    async startGame() {
      throw new Error("not used");
    },
  } satisfies RoomService;

  return { calls, service };
}

function createFakeGameSessionService() {
  const calls = {
    cleanupExpiredDisconnects: [] as unknown[],
  };
  const service = {
    async createGameSessionFromRoom() {
      throw new Error("not used");
    },
    async submitCommand() {
      throw new Error("not used");
    },
    async markDisconnected() {
      return null;
    },
    async markReconnected() {
      return null;
    },
    async getPlayerSnapshot() {
      throw new Error("not used");
    },
    async cleanupExpiredDisconnects(input) {
      calls.cleanupExpiredDisconnects.push(input);
      return [
        {
          gameSessionId: "game-1",
          result: {
            reason: "invalidated",
            message: "A seated player disconnected",
          },
        },
      ];
    },
  } satisfies GameSessionService;

  return { calls, service };
}

function createFakeNotifier() {
  const calls = {
    publishGameEnded: [] as unknown[],
  };
  const notifier = {
    publishRoomUpdated() {
      throw new Error("not used");
    },
    publishGameStarted() {
      throw new Error("not used");
    },
    publishGameUpdated() {
      throw new Error("not used");
    },
    publishGameEnded(gameSessionId, result) {
      calls.publishGameEnded.push({ gameSessionId, result });
    },
  } satisfies LiveNotifier;

  return { calls, notifier };
}

describe("createDisconnectCleanupService", () => {
  it("cleans expired room and game disconnects and publishes ended games", async () => {
    const roomService = createFakeRoomService();
    const gameSessionService = createFakeGameSessionService();
    const notifier = createFakeNotifier();
    const cleanup = createDisconnectCleanupService({
      clock: { now: () => new Date("2026-04-20T12:01:00.000Z") },
      roomService: roomService.service,
      gameSessionService: gameSessionService.service,
      notifier: notifier.notifier,
      disconnectGraceMs: 45_000,
    });

    const result = await cleanup.runOnce();

    expect(roomService.calls.cleanupExpiredDisconnects).toEqual([
      { olderThan: new Date("2026-04-20T12:00:15.000Z") },
    ]);
    expect(gameSessionService.calls.cleanupExpiredDisconnects).toEqual([
      { olderThan: new Date("2026-04-20T12:00:15.000Z") },
    ]);
    expect(notifier.calls.publishGameEnded).toEqual([
      {
        gameSessionId: "game-1",
        result: {
          reason: "invalidated",
          message: "A seated player disconnected",
        },
      },
    ]);
    expect(result).toEqual({ roomsProcessed: 1, gamesEnded: 1 });
  });
});
