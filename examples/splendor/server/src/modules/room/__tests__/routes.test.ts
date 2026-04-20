import { describe, expect, it } from "bun:test";
import { createApp, type AppDeps } from "../../../app";
import { AppError } from "../../errors";
import { createLiveConnectionRegistry } from "../../websocket";
import type {
  CreateRoomInput,
  JoinRoomInput,
  RoomService,
  RoomSnapshot,
} from "../index";

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
      },
    ],
  };
}

function createFakeRoomService(overrides: Partial<RoomService> = {}) {
  const calls: {
    createRoom: CreateRoomInput[];
    joinRoom: JoinRoomInput[];
  } = {
    createRoom: [],
    joinRoom: [],
  };
  const service: RoomService = {
    async createRoom(input) {
      calls.createRoom.push(input);
      return {
        playerSessionToken: "token-1",
        room: createRoomSnapshot(),
      };
    },
    async joinRoom(input) {
      calls.joinRoom.push(input);
      return {
        playerSessionToken: "token-2",
        room: createRoomSnapshot(),
      };
    },
    async setReady() {
      throw new Error("not used");
    },
    async leaveRoom() {
      throw new Error("not used");
    },
    async startGame() {
      throw new Error("not used");
    },
    ...overrides,
  };

  return { calls, service };
}

function createAppDeps(roomService: RoomService): AppDeps {
  return {
    roomService,
    websocket: {
      registry: createLiveConnectionRegistry(),
      roomService,
      sessionService: {
        async resolveOrCreatePlayerSession() {
          return {
            playerSessionId: "s-1",
            token: "t-1",
            tokenWasCreated: true,
          };
        },
      },
    },
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<unknown>;
}

describe("room routes", () => {
  it("returns health status", async () => {
    const { service } = createFakeRoomService();
    const app = createApp(createAppDeps(service));

    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ status: "ok" });
  });

  it("creates a room and returns the player session token", async () => {
    const { calls, service } = createFakeRoomService();
    const app = createApp(createAppDeps(service));

    const response = await app.handle(
      new Request("http://localhost/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Host",
          playerSessionToken: "existing-token",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls.createRoom).toEqual([
      {
        displayName: "Host",
        token: "existing-token",
      },
    ]);
    expect(await readJson(response)).toEqual({
      playerSessionToken: "token-1",
      room: createRoomSnapshot(),
    });
  });

  it("joins a room and returns the room snapshot", async () => {
    const { calls, service } = createFakeRoomService();
    const app = createApp(createAppDeps(service));

    const response = await app.handle(
      new Request("http://localhost/rooms/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomCode: "ABC123",
          displayName: "Second",
          playerSessionToken: "existing-token",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls.joinRoom).toEqual([
      {
        roomCode: "ABC123",
        displayName: "Second",
        token: "existing-token",
      },
    ]);
    expect(await readJson(response)).toEqual({
      playerSessionToken: "token-2",
      room: createRoomSnapshot(),
    });
  });

  it("serializes route errors through the shared error handler", async () => {
    const { service } = createFakeRoomService({
      async joinRoom() {
        throw new AppError("room_not_found", 404, "Room not found");
      },
    });
    const app = createApp(createAppDeps(service));

    const response = await app.handle(
      new Request("http://localhost/rooms/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomCode: "ABC123",
          displayName: "Second",
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({
      error: {
        code: "room_not_found",
        message: "Room not found",
      },
    });
  });
});
