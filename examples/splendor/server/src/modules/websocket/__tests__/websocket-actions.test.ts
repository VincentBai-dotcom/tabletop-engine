import { describe, expect, it } from "bun:test";
import type { GameSessionService } from "../../game-session";
import type { LivePresenceService } from "../../live-presence";
import type { RoomService } from "../../room";
import { createLiveMessageHandler } from "../actions";
import type { LiveConnection } from "../model";
import { createLiveConnectionRegistry } from "../registry";

function createRecordingConnection(id: string) {
  const sent: unknown[] = [];
  const connection: LiveConnection = {
    id,
    send(payload) {
      sent.push(payload);
    },
  };

  return { connection, sent };
}

function createUnusedRoomService() {
  return {
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
}

function createFakeGameSessionService(
  submitCommand: GameSessionService["submitCommand"],
) {
  return {
    async createGameSessionFromRoom() {
      throw new Error("not used");
    },
    submitCommand,
    async markDisconnected() {
      return null;
    },
    async markReconnected() {
      return null;
    },
    async getPlayerSnapshot() {
      throw new Error("not used");
    },
    async cleanupExpiredDisconnects() {
      return [];
    },
  } satisfies GameSessionService;
}

function createFakeLivePresenceService() {
  const calls = {
    handleGameSubscribed: [] as unknown[],
  };
  const livePresenceService = {
    async handleClosedSubscription() {
      throw new Error("not used");
    },
    async handleRoomSubscribed() {
      throw new Error("not used");
    },
    async handleGameSubscribed(input) {
      calls.handleGameSubscribed.push(input);
      return {
        type: "game_snapshot",
        stateVersion: 3,
        view: { game: "snapshot" },
        events: [],
      };
    },
  } satisfies LivePresenceService;

  return { calls, livePresenceService };
}

describe("game websocket actions", () => {
  it("routes game commands to the game session service", async () => {
    const calls: unknown[] = [];
    const registry = createLiveConnectionRegistry();
    const client = createRecordingConnection("conn-1");
    registry.register("session-1", client.connection);
    registry.subscribeToGame("session-1", "game-1");
    const handler = createLiveMessageHandler({
      registry,
      roomService: createUnusedRoomService(),
      gameSessionService: createFakeGameSessionService(async (input) => {
        calls.push(input);
        return {
          accepted: false,
          stateVersion: 0,
          reason: "unknown_command",
          events: [],
        };
      }),
    });

    await handler.handleMessage(client.connection, {
      type: "game_command",
      gameSessionId: "game-1",
      command: { type: "unknown_command", input: {} },
    });

    expect(calls).toEqual([
      {
        gameSessionId: "game-1",
        playerSessionId: "session-1",
        command: { type: "unknown_command", input: {} },
      },
    ]);
  });

  it("sends successful command views to each subscribed player", async () => {
    const registry = createLiveConnectionRegistry();
    const first = createRecordingConnection("conn-1");
    const second = createRecordingConnection("conn-2");
    registry.register("session-1", first.connection);
    registry.register("session-2", second.connection);
    registry.subscribeToGame("session-1", "game-1");
    registry.subscribeToGame("session-2", "game-1");
    const handler = createLiveMessageHandler({
      registry,
      roomService: createUnusedRoomService(),
      gameSessionService: createFakeGameSessionService(async () => ({
        accepted: true,
        stateVersion: 2,
        events: [
          {
            category: "command",
            type: "command_executed",
            payload: {},
          },
        ],
        playerViews: [
          {
            playerSessionId: "session-1",
            playerId: "player-1",
            view: { self: true },
          },
          {
            playerSessionId: "session-2",
            playerId: "player-2",
            view: { self: false },
          },
        ],
      })),
    });

    await handler.handleMessage(first.connection, {
      type: "game_command",
      gameSessionId: "game-1",
      command: { type: "take_three_distinct_gems", input: {} },
    });

    expect(first.sent).toEqual([
      {
        type: "game_updated",
        stateVersion: 2,
        events: [
          {
            category: "command",
            type: "command_executed",
            payload: {},
          },
        ],
        view: { self: true },
      },
    ]);
    expect(second.sent).toEqual([
      {
        type: "game_updated",
        stateVersion: 2,
        events: [
          {
            category: "command",
            type: "command_executed",
            payload: {},
          },
        ],
        view: { self: false },
      },
    ]);
  });

  it("sends failed command reasons to the submitting player", async () => {
    const registry = createLiveConnectionRegistry();
    const client = createRecordingConnection("conn-1");
    registry.register("session-1", client.connection);
    registry.subscribeToGame("session-1", "game-1");
    const handler = createLiveMessageHandler({
      registry,
      roomService: createUnusedRoomService(),
      gameSessionService: createFakeGameSessionService(async () => ({
        accepted: false,
        stateVersion: 0,
        reason: "not_active_player",
        events: [],
      })),
    });

    await handler.handleMessage(client.connection, {
      type: "game_command",
      gameSessionId: "game-1",
      command: { type: "take_three_distinct_gems", input: {} },
    });

    expect(client.sent).toEqual([
      {
        type: "error",
        code: "not_active_player",
        message: "Command rejected",
      },
    ]);
  });

  it("switches subscription to a game session", async () => {
    const registry = createLiveConnectionRegistry();
    const client = createRecordingConnection("conn-1");
    registry.register("session-1", client.connection);
    registry.subscribeToRoom("session-1", "room-1");
    const { calls, livePresenceService } = createFakeLivePresenceService();
    const handler = createLiveMessageHandler({
      registry,
      roomService: createUnusedRoomService(),
      livePresenceService,
      gameSessionService: createFakeGameSessionService(async () => ({
        accepted: false,
        stateVersion: 0,
        reason: "not used",
        events: [],
      })),
    });

    await handler.handleMessage(client.connection, {
      type: "subscribe_game",
      gameSessionId: "game-1",
    });

    expect(registry.getRoomConnections("room-1")).toEqual([]);
    expect(registry.getGameConnections("game-1")).toEqual([client.connection]);
    expect(calls.handleGameSubscribed).toEqual([
      { gameSessionId: "game-1", playerSessionId: "session-1" },
    ]);
    expect(client.sent).toEqual([
      {
        type: "game_snapshot",
        stateVersion: 3,
        view: { game: "snapshot" },
        events: [],
      },
    ]);
  });
});
