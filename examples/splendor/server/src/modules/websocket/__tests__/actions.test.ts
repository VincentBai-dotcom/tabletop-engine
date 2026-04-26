import { describe, expect, it } from "bun:test";
import { AppError } from "../../errors";
import type { LivePresenceService } from "../../live-presence";
import type { RoomService } from "../../room";
import type { RoomSnapshot } from "../../room";
import { createLiveConnectionRegistry } from "../registry";
import { createLiveMessageHandler } from "../actions";
import type { LiveConnection } from "../model";

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

function createFakeRoomService() {
  const calls = {
    setReady: [] as unknown[],
    leaveRoom: [] as unknown[],
    startGame: [] as unknown[],
  };
  const room: RoomSnapshot = {
    id: "room-1",
    code: "ABC123",
    status: "open",
    hostPlayerSessionId: "session-1",
    players: [],
  };
  const roomService = {
    async createRoom() {
      throw new Error("not used");
    },
    async joinRoom() {
      throw new Error("not used");
    },
    async setReady(input) {
      calls.setReady.push(input);
      return { room: null, roomDeleted: false };
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
    async leaveRoom(input) {
      calls.leaveRoom.push(input);
      return { room: null, roomDeleted: true };
    },
    async startGame(input) {
      calls.startGame.push(input);
      return { room, gameSessionId: "game-1" };
    },
  } satisfies RoomService;

  return { calls, roomService };
}

function createFakeLivePresenceService(room: RoomSnapshot) {
  const calls = {
    handleRoomSubscribed: [] as unknown[],
    handleGameSubscribed: [] as unknown[],
  };
  const livePresenceService = {
    async handleClosedSubscription() {
      throw new Error("not used");
    },
    async handleRoomSubscribed(input) {
      calls.handleRoomSubscribed.push(input);
      return { type: "room_snapshot", room };
    },
    async handleGameSubscribed(input) {
      calls.handleGameSubscribed.push(input);
      return {
        type: "game_snapshot",
        gameSessionId: "game-1",
        stateVersion: 0,
        view: { game: "view" },
        availableCommands: ["take_three_distinct_gems"],
        events: [],
      };
    },
  } satisfies LivePresenceService;

  return { calls, livePresenceService };
}

describe("createLiveMessageHandler", () => {
  it("subscribes the connection to a room", async () => {
    const registry = createLiveConnectionRegistry();
    const client = createRecordingConnection("conn-1");
    const { roomService } = createFakeRoomService();
    const room: RoomSnapshot = {
      id: "room-1",
      code: "ABC123",
      status: "open",
      hostPlayerSessionId: "session-1",
      players: [],
    };
    const { calls, livePresenceService } = createFakeLivePresenceService(room);
    registry.register("session-1", client.connection);
    const handler = createLiveMessageHandler({
      registry,
      roomService,
      livePresenceService,
    });

    await handler.handleMessage(client.connection, {
      type: "subscribe_room",
      roomId: "room-1",
    });

    expect(registry.getRoomConnections("room-1")).toEqual([client.connection]);
    expect(calls.handleRoomSubscribed).toEqual([
      { playerSessionId: "session-1", roomId: "room-1" },
    ]);
    expect(client.sent).toEqual([{ type: "room_snapshot", room }]);
  });

  it("routes room ready messages to the room service", async () => {
    const registry = createLiveConnectionRegistry();
    const client = createRecordingConnection("conn-1");
    const { calls, roomService } = createFakeRoomService();
    registry.register("session-1", client.connection);
    const handler = createLiveMessageHandler({ registry, roomService });

    await handler.handleMessage(client.connection, {
      type: "room_set_ready",
      roomId: "room-1",
      ready: true,
    });

    expect(calls.setReady).toEqual([
      {
        playerSessionId: "session-1",
        roomId: "room-1",
        ready: true,
      },
    ]);
  });

  it("rejects messages from unregistered live connections", async () => {
    const registry = createLiveConnectionRegistry();
    const client = createRecordingConnection("conn-1");
    const { roomService } = createFakeRoomService();
    const handler = createLiveMessageHandler({ registry, roomService });

    await handler.handleMessage(client.connection, {
      type: "room_set_ready",
      roomId: "room-1",
      ready: true,
    });

    expect(client.sent).toEqual([
      {
        type: "error",
        code: "live_connection_not_registered",
        message: "Live connection is not registered",
      },
    ]);
  });

  it("routes room leave and start messages to the room service", async () => {
    const registry = createLiveConnectionRegistry();
    const client = createRecordingConnection("conn-1");
    const { calls, roomService } = createFakeRoomService();
    registry.register("session-1", client.connection);
    const handler = createLiveMessageHandler({ registry, roomService });

    await handler.handleMessage(client.connection, {
      type: "room_leave",
      roomId: "room-1",
    });
    await handler.handleMessage(client.connection, {
      type: "room_start_game",
      roomId: "room-1",
    });

    expect(calls.leaveRoom).toEqual([
      {
        playerSessionId: "session-1",
        roomId: "room-1",
      },
    ]);
    expect(calls.startGame).toEqual([
      {
        playerSessionId: "session-1",
        roomId: "room-1",
      },
    ]);
  });

  it("sends application errors to the client", async () => {
    const registry = createLiveConnectionRegistry();
    const client = createRecordingConnection("conn-1");
    const roomService = {
      ...createFakeRoomService().roomService,
      async setReady() {
        throw new AppError("room_not_found", 404, "Room not found");
      },
    } satisfies RoomService;
    registry.register("session-1", client.connection);
    const handler = createLiveMessageHandler({ registry, roomService });

    await handler.handleMessage(client.connection, {
      type: "room_set_ready",
      roomId: "room-1",
      ready: true,
    });

    expect(client.sent).toEqual([
      {
        type: "error",
        code: "room_not_found",
        message: "Room not found",
      },
    ]);
  });

  it("returns not implemented for game commands until game service is wired", async () => {
    const registry = createLiveConnectionRegistry();
    const client = createRecordingConnection("conn-1");
    const { roomService } = createFakeRoomService();
    registry.register("session-1", client.connection);
    const handler = createLiveMessageHandler({ registry, roomService });

    await handler.handleMessage(client.connection, {
      type: "game_execute",
      requestId: "request-1",
      gameSessionId: "game-1",
      command: { type: "noop" },
    });

    expect(client.sent).toEqual([
      {
        type: "error",
        requestId: "request-1",
        code: "game_commands_not_implemented",
        message: "Game commands are not implemented yet",
      },
    ]);
  });

  it("returns not implemented for game discovery until game service is wired", async () => {
    const registry = createLiveConnectionRegistry();
    const client = createRecordingConnection("conn-1");
    const { roomService } = createFakeRoomService();
    registry.register("session-1", client.connection);
    const handler = createLiveMessageHandler({ registry, roomService });

    await handler.handleMessage(client.connection, {
      type: "game_discover",
      requestId: "request-1",
      gameSessionId: "game-1",
      discovery: { type: "take_two_same_gems", step: "select_gem_color" },
    });

    expect(client.sent).toEqual([
      {
        type: "error",
        requestId: "request-1",
        code: "game_commands_not_implemented",
        message: "Game commands are not implemented yet",
      },
    ]);
  });
});
