import { describe, expect, it } from "bun:test";
import { createRoomService } from "../service";
import type {
  CreateRoomWithHostInput,
  RoomNotifier,
  RoomPlayerSnapshot,
  RoomSnapshot,
  RoomStore,
} from "../model";
import type {
  ResolvePlayerSessionInput,
  ResolvePlayerSessionResult,
} from "../../player-session";

class FakeRoomStore implements RoomStore {
  readonly rooms = new Map<string, RoomSnapshot>();
  readonly markedStartingRoomIds: string[] = [];
  beforeNextLoadRoomSnapshot: (() => void) | null = null;
  private nextRoomId = 1;
  private nextPlayerSessionId = 1;

  async createRoomWithHost(input: CreateRoomWithHostInput) {
    const room: RoomSnapshot = {
      id: `room-${this.nextRoomId++}`,
      code: input.code,
      status: "open",
      hostPlayerSessionId: input.hostPlayerSessionId,
      players: [
        {
          playerSessionId: input.hostPlayerSessionId,
          seatIndex: 0,
          displayName: input.displayName,
          displayNameKey: input.displayNameKey,
          isReady: false,
          isHost: true,
          disconnectedAt: null,
        },
      ],
    };
    this.rooms.set(room.id, room);
    return room;
  }

  async roomCodeExists(code: string) {
    return [...this.rooms.values()].some((room) => room.code === code);
  }

  async loadOpenRoomByCode(code: string) {
    return (
      [...this.rooms.values()].find(
        (room) => room.code === code && room.status === "open",
      ) ?? null
    );
  }

  async loadRoomSnapshot(roomId: string) {
    this.beforeNextLoadRoomSnapshot?.();
    this.beforeNextLoadRoomSnapshot = null;
    return this.rooms.get(roomId) ?? null;
  }

  async addRoomPlayer(input: {
    roomId: string;
    playerSessionId: string;
    seatIndex: number;
    displayName: string;
    displayNameKey: string;
  }) {
    const room = this.requireRoom(input.roomId);
    room.players.push({
      playerSessionId: input.playerSessionId,
      seatIndex: input.seatIndex,
      displayName: input.displayName,
      displayNameKey: input.displayNameKey,
      isReady: false,
      isHost: false,
      disconnectedAt: null,
    });
    room.players.sort((left, right) => left.seatIndex - right.seatIndex);
    return room;
  }

  async setRoomPlayerReady(input: {
    roomId: string;
    playerSessionId: string;
    ready: boolean;
  }) {
    const player = this.requirePlayer(input.roomId, input.playerSessionId);
    player.isReady = input.ready;
    return this.requireRoom(input.roomId);
  }

  async markRoomPlayerDisconnected(input: {
    roomId: string;
    playerSessionId: string;
    disconnectedAt: Date;
  }) {
    const player = this.requirePlayer(input.roomId, input.playerSessionId);
    player.disconnectedAt = input.disconnectedAt;
    return this.requireRoom(input.roomId);
  }

  async clearRoomPlayerDisconnected(input: {
    roomId: string;
    playerSessionId: string;
  }) {
    const player = this.requirePlayer(input.roomId, input.playerSessionId);
    player.disconnectedAt = null;
    return this.requireRoom(input.roomId);
  }

  async loadExpiredDisconnectedRoomPlayers(input: { olderThan: Date }) {
    const expiredPlayers: Array<{ roomId: string; playerSessionId: string }> =
      [];

    for (const room of this.rooms.values()) {
      for (const player of room.players) {
        if (
          player.disconnectedAt &&
          player.disconnectedAt.getTime() < input.olderThan.getTime()
        ) {
          expiredPlayers.push({
            roomId: room.id,
            playerSessionId: player.playerSessionId,
          });
        }
      }
    }

    return expiredPlayers;
  }

  async removeRoomPlayer(input: { roomId: string; playerSessionId: string }) {
    const room = this.requireRoom(input.roomId);
    room.players = room.players.filter(
      (player) => player.playerSessionId !== input.playerSessionId,
    );
    return room;
  }

  async deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
  }

  async updateRoomHost(input: { roomId: string; playerSessionId: string }) {
    const room = this.requireRoom(input.roomId);
    room.hostPlayerSessionId = input.playerSessionId;
    for (const player of room.players) {
      player.isHost = player.playerSessionId === input.playerSessionId;
    }
    return room;
  }

  async markRoomStarting(roomId: string) {
    this.markedStartingRoomIds.push(roomId);
    const room = this.requireRoom(roomId);
    room.status = "starting";
    return room;
  }

  addExistingRoom(room: RoomSnapshot) {
    this.rooms.set(room.id, room);
  }

  nextSessionId() {
    return `session-${this.nextPlayerSessionId++}`;
  }

  private requireRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error("missing fake room");
    }
    return room;
  }

  private requirePlayer(roomId: string, playerSessionId: string) {
    const room = this.requireRoom(roomId);
    const player = room.players.find(
      (candidate) => candidate.playerSessionId === playerSessionId,
    );
    if (!player) {
      throw new Error("missing fake room player");
    }
    return player;
  }
}

function createFakeSessionResolver(store: FakeRoomStore) {
  return async function resolveOrCreatePlayerSession(
    input: ResolvePlayerSessionInput,
  ): Promise<ResolvePlayerSessionResult> {
    if (input.token?.startsWith("known:")) {
      const playerSessionId = input.token.slice("known:".length);
      return {
        playerSessionId,
        token: input.token,
        tokenWasCreated: false,
      };
    }

    const playerSessionId = store.nextSessionId();
    return {
      playerSessionId,
      token: `known:${playerSessionId}`,
      tokenWasCreated: true,
    };
  };
}

function createFakeNotifier(): RoomNotifier & {
  updates: RoomSnapshot[];
  starts: Array<{ roomId: string; gameSessionId: string }>;
} {
  return {
    updates: [],
    starts: [],
    publishRoomUpdated(room) {
      this.updates.push(room);
    },
    publishGameStarted(payload) {
      this.starts.push(payload);
    },
  };
}

function createRoom(playerIds: string[]): RoomSnapshot {
  const players: RoomPlayerSnapshot[] = playerIds.map(
    (playerSessionId, index) => ({
      playerSessionId,
      seatIndex: index,
      displayName: `Player ${index + 1}`,
      displayNameKey: `player ${index + 1}`,
      isReady: false,
      isHost: index === 0,
      disconnectedAt: null,
    }),
  );

  return {
    id: "room-1",
    code: "ABC123",
    status: "open",
    hostPlayerSessionId: playerIds[0] ?? "missing",
    players,
  };
}

function createTestService() {
  const store = new FakeRoomStore();
  const notifier = createFakeNotifier();
  let nextCode = "ABC123";
  let nextGameSessionId = "game-1";
  const service = createRoomService({
    store,
    resolveOrCreatePlayerSession: createFakeSessionResolver(store),
    roomCodeGenerator: () => nextCode,
    notifier,
    startGameFromRoom: async () => ({ gameSessionId: nextGameSessionId }),
  });

  return {
    notifier,
    service,
    store,
    setNextCode(code: string) {
      nextCode = code;
    },
    setNextGameSessionId(gameSessionId: string) {
      nextGameSessionId = gameSessionId;
    },
  };
}

describe("createRoomService", () => {
  it("creates a room with the creator as host at seat 0", async () => {
    const { service } = createTestService();

    const result = await service.createRoom({
      token: null,
      displayName: "Vincent",
    });

    expect(result.playerSessionToken).toBe("known:session-1");
    expect(result.room.code).toBe("ABC123");
    expect(result.room.hostPlayerSessionId).toBe("session-1");
    expect(result.room.players).toEqual([
      {
        playerSessionId: "session-1",
        seatIndex: 0,
        displayName: "Vincent",
        displayNameKey: "vincent",
        isReady: false,
        isHost: true,
        disconnectedAt: null,
      },
    ]);
  });

  it("joins a room into the next available seat", async () => {
    const { service } = createTestService();
    await service.createRoom({ token: null, displayName: "Host" });

    const result = await service.joinRoom({
      token: null,
      roomCode: "abc123",
      displayName: "Second",
    });

    expect(result.playerSessionToken).toBe("known:session-2");
    expect(result.room.players.map((player) => player.seatIndex)).toEqual([
      0, 1,
    ]);
    expect(result.room.players[1]?.displayName).toBe("Second");
  });

  it("rejects joining a full room", async () => {
    const { service, store } = createTestService();
    store.addExistingRoom(createRoom(["host", "p2", "p3", "p4"]));

    await expect(
      service.joinRoom({
        token: null,
        roomCode: "ABC123",
        displayName: "Fifth",
      }),
    ).rejects.toMatchObject({ code: "room_full" });
  });

  it("rejects duplicate display names within a room", async () => {
    const { service } = createTestService();
    await service.createRoom({ token: null, displayName: "Vincent Bai" });

    await expect(
      service.joinRoom({
        token: null,
        roomCode: "ABC123",
        displayName: "  vincent   bai  ",
      }),
    ).rejects.toMatchObject({ code: "display_name_taken" });
  });

  it("toggles readiness only for seated players", async () => {
    const { service } = createTestService();
    const created = await service.createRoom({
      token: null,
      displayName: "Host",
    });

    const result = await service.setReady({
      roomId: created.room.id,
      playerSessionId: created.room.players[0]!.playerSessionId,
      ready: true,
    });

    const room = result.room;
    expect(room).not.toBeNull();
    if (!room) {
      throw new Error("expected room update");
    }
    expect(room.players[0]?.isReady).toBe(true);
    await expect(
      service.setReady({
        roomId: created.room.id,
        playerSessionId: "not-seated",
        ready: true,
      }),
    ).rejects.toMatchObject({ code: "room_player_not_found" });
  });

  it("requires the host to start the game", async () => {
    const { service, store } = createTestService();
    const room = createRoom(["host", "p2"]);
    room.players.forEach((player) => {
      player.isReady = true;
    });
    store.addExistingRoom(room);

    await expect(
      service.startGame({ roomId: room.id, playerSessionId: "p2" }),
    ).rejects.toMatchObject({ code: "room_host_required" });
  });

  it("requires two to four players to start the game", async () => {
    const { service, store } = createTestService();
    const room = createRoom(["host"]);
    room.players[0]!.isReady = true;
    store.addExistingRoom(room);

    await expect(
      service.startGame({ roomId: room.id, playerSessionId: "host" }),
    ).rejects.toMatchObject({ code: "room_needs_more_players" });
  });

  it("requires all seated players to be ready before start", async () => {
    const { service, store } = createTestService();
    const room = createRoom(["host", "p2"]);
    room.players[0]!.isReady = true;
    room.players[1]!.isReady = false;
    store.addExistingRoom(room);

    await expect(
      service.startGame({ roomId: room.id, playerSessionId: "host" }),
    ).rejects.toMatchObject({ code: "room_players_not_ready" });
  });

  it("requires all seated players to be connected before start", async () => {
    const { service, store } = createTestService();
    const room = createRoom(["host", "p2"]);
    room.players.forEach((player) => {
      player.isReady = true;
    });
    room.players[1]!.disconnectedAt = new Date("2026-04-20T12:00:00.000Z");
    store.addExistingRoom(room);

    await expect(
      service.startGame({ roomId: room.id, playerSessionId: "host" }),
    ).rejects.toMatchObject({ code: "room_players_disconnected" });
  });

  it("marks the room starting and publishes game started when start succeeds", async () => {
    const { notifier, service, store } = createTestService();
    const room = createRoom(["host", "p2"]);
    room.players.forEach((player) => {
      player.isReady = true;
    });
    store.addExistingRoom(room);

    const result = await service.startGame({
      roomId: room.id,
      playerSessionId: "host",
    });

    expect(result.gameSessionId).toBe("game-1");
    expect(store.markedStartingRoomIds).toEqual([room.id]);
    expect(notifier.starts).toEqual([
      { roomId: room.id, gameSessionId: "game-1" },
    ]);
  });

  it("transfers host to the next seat when the host leaves", async () => {
    const { service, store } = createTestService();
    store.addExistingRoom(createRoom(["host", "p2", "p3"]));

    const result = await service.leaveRoom({
      roomId: "room-1",
      playerSessionId: "host",
    });

    expect(result.room?.hostPlayerSessionId).toBe("p2");
    expect(result.room?.players.map((player) => player.isHost)).toEqual([
      true,
      false,
    ]);
  });

  it("deletes the room when the last player leaves", async () => {
    const { service, store } = createTestService();
    store.addExistingRoom(createRoom(["host"]));

    const result = await service.leaveRoom({
      roomId: "room-1",
      playerSessionId: "host",
    });

    expect(result.room).toBeNull();
    expect(result.roomDeleted).toBe(true);
    expect(await store.loadRoomSnapshot("room-1")).toBeNull();
  });

  it("marks a seated player temporarily disconnected", async () => {
    const { notifier, service, store } = createTestService();
    const disconnectedAt = new Date("2026-04-20T12:00:00.000Z");
    store.addExistingRoom(createRoom(["host", "p2"]));

    const result = await service.markDisconnected({
      roomId: "room-1",
      playerSessionId: "p2",
      disconnectedAt,
    });

    expect(result.roomDeleted).toBe(false);
    expect(result.room).not.toBeNull();
    if (!result.room) {
      throw new Error("expected room update");
    }
    expect(
      result.room?.players.find((player) => player.playerSessionId === "p2"),
    ).toMatchObject({ disconnectedAt });
    expect(result.room?.players).toHaveLength(2);
    expect(notifier.updates[notifier.updates.length - 1]).toBe(result.room);
  });

  it("clears temporary room disconnects on reconnect", async () => {
    const { notifier, service, store } = createTestService();
    const room = createRoom(["host", "p2"]);
    room.players[1]!.disconnectedAt = new Date("2026-04-20T12:00:00.000Z");
    store.addExistingRoom(room);

    const result = await service.markReconnected({
      roomId: "room-1",
      playerSessionId: "p2",
    });

    expect(result.room).not.toBeNull();
    if (!result.room) {
      throw new Error("expected room update");
    }
    expect(
      result.room?.players.find((player) => player.playerSessionId === "p2")
        ?.disconnectedAt,
    ).toBeNull();
    expect(notifier.updates[notifier.updates.length - 1]).toBe(result.room);
  });

  it("removes expired disconnected non-host room players", async () => {
    const { service, store } = createTestService();
    const room = createRoom(["host", "p2", "p3"]);
    room.players[1]!.disconnectedAt = new Date("2026-04-20T12:00:00.000Z");
    store.addExistingRoom(room);

    await service.cleanupExpiredDisconnects({
      olderThan: new Date("2026-04-20T12:00:45.000Z"),
    });

    expect(
      store.rooms
        .get("room-1")
        ?.players.map((player) => player.playerSessionId),
    ).toEqual(["host", "p3"]);
  });

  it("keeps room players who reconnect before cleanup removes them", async () => {
    const { service, store } = createTestService();
    const room = createRoom(["host", "p2", "p3"]);
    room.players[1]!.disconnectedAt = new Date("2026-04-20T12:00:00.000Z");
    store.addExistingRoom(room);
    store.beforeNextLoadRoomSnapshot = () => {
      room.players[1]!.disconnectedAt = null;
    };

    const processedCount = await service.cleanupExpiredDisconnects({
      olderThan: new Date("2026-04-20T12:00:45.000Z"),
    });

    expect(processedCount).toBe(0);
    expect(
      store.rooms
        .get("room-1")
        ?.players.map((player) => player.playerSessionId),
    ).toEqual(["host", "p2", "p3"]);
  });

  it("transfers host when an expired disconnected host is removed", async () => {
    const { service, store } = createTestService();
    const room = createRoom(["host", "p2", "p3"]);
    room.players[0]!.disconnectedAt = new Date("2026-04-20T12:00:00.000Z");
    store.addExistingRoom(room);

    await service.cleanupExpiredDisconnects({
      olderThan: new Date("2026-04-20T12:00:45.000Z"),
    });

    expect(store.rooms.get("room-1")?.hostPlayerSessionId).toBe("p2");
    expect(
      store.rooms.get("room-1")?.players.map((player) => player.isHost),
    ).toEqual([true, false]);
  });

  it("deletes the room when the last disconnected player expires", async () => {
    const { service, store } = createTestService();
    const room = createRoom(["host"]);
    room.players[0]!.disconnectedAt = new Date("2026-04-20T12:00:00.000Z");
    store.addExistingRoom(room);

    await service.cleanupExpiredDisconnects({
      olderThan: new Date("2026-04-20T12:00:45.000Z"),
    });

    expect(await store.loadRoomSnapshot("room-1")).toBeNull();
  });
});
