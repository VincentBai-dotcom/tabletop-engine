import { describe, expect, it } from "bun:test";
import type { GameSessionService } from "../../game-session";
import type { RoomService, RoomSnapshot } from "../../room";
import { createLivePresenceService } from "../service";

function createRoomSnapshot(): RoomSnapshot {
  return {
    id: "room-1",
    code: "ABC123",
    status: "open",
    hostPlayerSessionId: "session-1",
    players: [
      {
        playerSessionId: "session-1",
        seatIndex: 0,
        displayName: "Host",
        displayNameKey: "host",
        isReady: false,
        isHost: true,
        disconnectedAt: null,
      },
    ],
  };
}

function createFakeRoomService() {
  const calls = {
    markDisconnected: [] as unknown[],
    markReconnected: [] as unknown[],
  };
  const room = createRoomSnapshot();
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
    async markDisconnected(input) {
      calls.markDisconnected.push(input);
      return { room, roomDeleted: false };
    },
    async markReconnected(input) {
      calls.markReconnected.push(input);
      return { room, roomDeleted: false };
    },
    async cleanupExpiredDisconnects() {
      return 0;
    },
    async leaveRoom() {
      throw new Error("not used");
    },
    async startGame() {
      throw new Error("not used");
    },
  } satisfies RoomService;

  return { calls, room, service };
}

function createFakeGameSessionService() {
  const calls = {
    markDisconnected: [] as unknown[],
    markReconnected: [] as unknown[],
  };
  const service = {
    async createGameSessionFromRoom() {
      throw new Error("not used");
    },
    async submitCommand() {
      throw new Error("not used");
    },
    async markDisconnected(input) {
      calls.markDisconnected.push(input);
      return null;
    },
    async markReconnected(input) {
      calls.markReconnected.push(input);
      return {
        gameSessionId: input.gameSessionId,
        stateVersion: 2,
        playerSessionId: input.playerSessionId,
        playerId: "player-1",
        view: { game: "view" },
      };
    },
    async getPlayerSnapshot() {
      throw new Error("not used");
    },
    async cleanupExpiredDisconnects() {
      return [];
    },
  } satisfies GameSessionService;

  return { calls, service };
}

describe("createLivePresenceService", () => {
  it("marks room subscriptions disconnected when the socket closes", async () => {
    const roomService = createFakeRoomService();
    const gameSessionService = createFakeGameSessionService();
    const service = createLivePresenceService({
      clock: { now: () => new Date("2026-04-20T12:00:00.000Z") },
      roomService: roomService.service,
      gameSessionService: gameSessionService.service,
    });

    await service.handleClosedSubscription({
      playerSessionId: "session-1",
      subscription: { type: "room", roomId: "room-1" },
    });

    expect(roomService.calls.markDisconnected).toEqual([
      {
        roomId: "room-1",
        playerSessionId: "session-1",
        disconnectedAt: new Date("2026-04-20T12:00:00.000Z"),
      },
    ]);
  });

  it("marks game subscriptions disconnected when the socket closes", async () => {
    const roomService = createFakeRoomService();
    const gameSessionService = createFakeGameSessionService();
    const service = createLivePresenceService({
      clock: { now: () => new Date("2026-04-20T12:00:00.000Z") },
      roomService: roomService.service,
      gameSessionService: gameSessionService.service,
    });

    await service.handleClosedSubscription({
      playerSessionId: "session-1",
      subscription: { type: "game", gameSessionId: "game-1" },
    });

    expect(gameSessionService.calls.markDisconnected).toEqual([
      {
        gameSessionId: "game-1",
        playerSessionId: "session-1",
      },
    ]);
  });

  it("clears room disconnects and returns a room snapshot on subscribe", async () => {
    const roomService = createFakeRoomService();
    const gameSessionService = createFakeGameSessionService();
    const service = createLivePresenceService({
      clock: { now: () => new Date("2026-04-20T12:00:00.000Z") },
      roomService: roomService.service,
      gameSessionService: gameSessionService.service,
    });

    const message = await service.handleRoomSubscribed({
      playerSessionId: "session-1",
      roomId: "room-1",
    });

    expect(roomService.calls.markReconnected).toEqual([
      { roomId: "room-1", playerSessionId: "session-1" },
    ]);
    expect(message).toEqual({ type: "room_snapshot", room: roomService.room });
  });

  it("clears game disconnects and returns a game snapshot on subscribe", async () => {
    const roomService = createFakeRoomService();
    const gameSessionService = createFakeGameSessionService();
    const service = createLivePresenceService({
      clock: { now: () => new Date("2026-04-20T12:00:00.000Z") },
      roomService: roomService.service,
      gameSessionService: gameSessionService.service,
    });

    const message = await service.handleGameSubscribed({
      playerSessionId: "session-1",
      gameSessionId: "game-1",
    });

    expect(gameSessionService.calls.markReconnected).toEqual([
      { gameSessionId: "game-1", playerSessionId: "session-1" },
    ]);
    expect(message).toEqual({
      type: "game_snapshot",
      stateVersion: 2,
      view: { game: "view" },
      events: [],
    });
  });
});
