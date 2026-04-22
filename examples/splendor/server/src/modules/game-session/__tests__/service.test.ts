import { describe, expect, it } from "bun:test";
import { createSplendorExecutor, type SplendorState } from "splendor-example";
import { createGameSessionService } from "../service";
import type {
  CreateGameSessionInput,
  GameSessionSnapshot,
  GameSessionStore,
} from "../model";
import type { RoomSnapshot } from "../../room";

function createRoom(): RoomSnapshot {
  return {
    id: "room-1",
    code: "ABC123",
    status: "starting",
    hostPlayerSessionId: "session-host",
    players: [
      {
        playerSessionId: "session-host",
        seatIndex: 0,
        displayName: "Host",
        displayNameKey: "host",
        isReady: true,
        isHost: true,
        disconnectedAt: null,
      },
      {
        playerSessionId: "session-2",
        seatIndex: 1,
        displayName: "Second",
        displayNameKey: "second",
        isReady: true,
        isHost: false,
        disconnectedAt: null,
      },
    ],
  };
}

class FakeGameSessionStore implements GameSessionStore {
  readonly rooms = new Map<string, RoomSnapshot>();
  readonly sessions = new Map<string, GameSessionSnapshot<SplendorState>>();
  readonly deletedRoomIds: string[] = [];
  readonly deletedGameSessionIds: string[] = [];
  readonly persistedVersions: number[] = [];
  beforeNextLoadGameSession: (() => void) | null = null;
  private nextGameSessionId = 1;

  async loadRoomForGameStart(roomId: string) {
    return this.rooms.get(roomId) ?? null;
  }

  async createGameSession(input: CreateGameSessionInput<SplendorState>) {
    const snapshot: GameSessionSnapshot<SplendorState> = {
      id: `game-${this.nextGameSessionId++}`,
      canonicalState: input.canonicalState,
      stateVersion: 0,
      players: input.players.map((player) => ({
        ...player,
        disconnectedAt: null,
      })),
    };
    this.sessions.set(snapshot.id, snapshot);
    return snapshot;
  }

  async loadGameSession(gameSessionId: string) {
    this.beforeNextLoadGameSession?.();
    this.beforeNextLoadGameSession = null;
    return this.sessions.get(gameSessionId) ?? null;
  }

  async persistAcceptedCommandResult(input: {
    gameSessionId: string;
    canonicalState: SplendorState;
    stateVersion: number;
  }) {
    const snapshot = this.sessions.get(input.gameSessionId);
    if (!snapshot) {
      throw new Error("missing fake game session");
    }
    snapshot.canonicalState = input.canonicalState;
    snapshot.stateVersion = input.stateVersion;
    this.persistedVersions.push(input.stateVersion);
    return snapshot;
  }

  async deleteRoom(roomId: string) {
    this.deletedRoomIds.push(roomId);
    this.rooms.delete(roomId);
  }

  async deleteGameSession(gameSessionId: string) {
    this.deletedGameSessionIds.push(gameSessionId);
    this.sessions.delete(gameSessionId);
  }

  async markPlayerDisconnected(input: {
    gameSessionId: string;
    playerSessionId: string;
    disconnectedAt: Date;
  }) {
    const snapshot = this.sessions.get(input.gameSessionId);
    if (!snapshot) {
      return null;
    }
    const player = snapshot.players.find(
      (candidate) => candidate.playerSessionId === input.playerSessionId,
    );
    if (!player) {
      return null;
    }
    player.disconnectedAt = input.disconnectedAt;
    return snapshot;
  }

  async clearPlayerDisconnected(input: {
    gameSessionId: string;
    playerSessionId: string;
  }) {
    const snapshot = this.sessions.get(input.gameSessionId);
    if (!snapshot) {
      return null;
    }
    const player = snapshot.players.find(
      (candidate) => candidate.playerSessionId === input.playerSessionId,
    );
    if (!player) {
      return null;
    }
    player.disconnectedAt = null;
    return snapshot;
  }

  async loadExpiredDisconnectedGamePlayers(input: { olderThan: Date }) {
    const expiredPlayers: Array<{
      gameSessionId: string;
      playerSessionId: string;
    }> = [];

    for (const snapshot of this.sessions.values()) {
      for (const player of snapshot.players) {
        if (
          player.disconnectedAt &&
          player.disconnectedAt.getTime() < input.olderThan.getTime()
        ) {
          expiredPlayers.push({
            gameSessionId: snapshot.id,
            playerSessionId: player.playerSessionId,
          });
        }
      }
    }

    return expiredPlayers;
  }
}

function createTestService(store: FakeGameSessionStore) {
  return createGameSessionService({
    store,
    gameExecutor: createSplendorExecutor(),
    rngSeedGenerator: () => "seed-1",
    clock: { now: () => new Date("2026-04-19T12:00:00.000Z") },
  });
}

describe("createGameSessionService", () => {
  async function createStartedGame() {
    const store = new FakeGameSessionStore();
    store.rooms.set("room-1", createRoom());
    const service = createTestService(store);
    await service.createGameSessionFromRoom({
      roomId: "room-1",
      requestingPlayerSessionId: "session-host",
    });

    return { service, store };
  }

  it("creates a game from room seats in seat order", async () => {
    const store = new FakeGameSessionStore();
    store.rooms.set("room-1", createRoom());
    const service = createTestService(store);

    const result = await service.createGameSessionFromRoom({
      roomId: "room-1",
      requestingPlayerSessionId: "session-host",
    });

    expect(result.gameSessionId).toBe("game-1");
    expect(result.stateVersion).toBe(0);
    expect(result.players).toEqual([
      {
        playerSessionId: "session-host",
        playerId: "player-1",
        seatIndex: 0,
        displayName: "Host",
        disconnectedAt: null,
      },
      {
        playerSessionId: "session-2",
        playerId: "player-2",
        seatIndex: 1,
        displayName: "Second",
        disconnectedAt: null,
      },
    ]);
    expect(result.canonicalState.runtime.rng.seed).toBe("seed-1");
    expect(
      Object.keys((result.canonicalState.game as { players: object }).players),
    ).toEqual(["player-1", "player-2"]);
    expect(store.deletedRoomIds).toEqual(["room-1"]);
  });

  it("maps player session to engine actor id when submitting commands", async () => {
    const store = new FakeGameSessionStore();
    store.rooms.set("room-1", createRoom());
    const service = createTestService(store);
    await service.createGameSessionFromRoom({
      roomId: "room-1",
      requestingPlayerSessionId: "session-host",
    });

    const result = await service.submitCommand({
      gameSessionId: "game-1",
      playerSessionId: "session-host",
      command: {
        type: "take_three_distinct_gems",
        input: {
          colors: ["white", "blue", "green"],
        },
      },
    });

    expect(result.accepted).toBe(true);
    expect(result.stateVersion).toBe(1);
    expect(store.persistedVersions).toEqual([1]);
    const session = await store.loadGameSession("game-1");
    const game = session?.canonicalState.game as {
      players: Record<
        string,
        {
          tokens: {
            white: number;
            blue: number;
            green: number;
            red: number;
            black: number;
            gold: number;
          };
        }
      >;
    };
    expect(game.players["player-1"]?.tokens).toEqual({
      white: 1,
      blue: 1,
      green: 1,
      red: 0,
      black: 0,
      gold: 0,
    });
  });

  it("does not persist failed commands", async () => {
    const store = new FakeGameSessionStore();
    store.rooms.set("room-1", createRoom());
    const service = createTestService(store);
    await service.createGameSessionFromRoom({
      roomId: "room-1",
      requestingPlayerSessionId: "session-host",
    });

    const result = await service.submitCommand({
      gameSessionId: "game-1",
      playerSessionId: "session-host",
      command: {
        type: "unknown_command",
        input: {},
      },
    });

    expect(result).toMatchObject({
      accepted: false,
      stateVersion: 0,
      reason: "unknown_command",
    });
    expect(store.persistedVersions).toEqual([]);
  });

  it("marks a player disconnected without deleting the game immediately", async () => {
    const { service, store } = await createStartedGame();

    const result = await service.markDisconnected({
      gameSessionId: "game-1",
      playerSessionId: "session-2",
    });

    expect(result?.players[1]?.disconnectedAt).toEqual(
      new Date("2026-04-19T12:00:00.000Z"),
    );
    expect(store.deletedGameSessionIds).toEqual([]);
    expect(await store.loadGameSession("game-1")).not.toBeNull();
  });

  it("clears a player disconnect and returns the latest player snapshot", async () => {
    const { service, store } = await createStartedGame();
    await store.markPlayerDisconnected({
      gameSessionId: "game-1",
      playerSessionId: "session-2",
      disconnectedAt: new Date("2026-04-19T12:00:00.000Z"),
    });

    const result = await service.markReconnected({
      gameSessionId: "game-1",
      playerSessionId: "session-2",
    });

    expect(result).toEqual({
      gameSessionId: "game-1",
      stateVersion: 0,
      playerSessionId: "session-2",
      playerId: "player-2",
      view: expect.any(Object),
    });
    expect(
      (await store.loadGameSession("game-1"))?.players[1]?.disconnectedAt,
    ).toBeNull();
  });

  it("returns a player snapshot for reconnect subscription recovery", async () => {
    const { service } = await createStartedGame();

    const result = await service.getPlayerSnapshot({
      gameSessionId: "game-1",
      playerSessionId: "session-host",
    });

    expect(result).toEqual({
      gameSessionId: "game-1",
      stateVersion: 0,
      playerSessionId: "session-host",
      playerId: "player-1",
      view: expect.any(Object),
    });
  });

  it("invalidates and deletes games when a disconnected player expires", async () => {
    const { service, store } = await createStartedGame();
    await store.markPlayerDisconnected({
      gameSessionId: "game-1",
      playerSessionId: "session-2",
      disconnectedAt: new Date("2026-04-19T12:00:00.000Z"),
    });

    const result = await service.cleanupExpiredDisconnects({
      olderThan: new Date("2026-04-19T12:00:45.000Z"),
    });

    expect(result).toEqual([
      {
        gameSessionId: "game-1",
        result: {
          reason: "invalidated",
          message: "A seated player disconnected",
        },
      },
    ]);
    expect(store.deletedGameSessionIds).toEqual(["game-1"]);
  });

  it("keeps games when the expired player reconnects before cleanup deletes", async () => {
    const { service, store } = await createStartedGame();
    const gameSession = store.sessions.get("game-1");
    if (!gameSession) {
      throw new Error("expected game session");
    }
    gameSession.players[1]!.disconnectedAt = new Date(
      "2026-04-19T12:00:00.000Z",
    );
    store.beforeNextLoadGameSession = () => {
      gameSession.players[1]!.disconnectedAt = null;
    };

    const result = await service.cleanupExpiredDisconnects({
      olderThan: new Date("2026-04-19T12:00:45.000Z"),
    });

    expect(result).toEqual([]);
    expect(store.deletedGameSessionIds).toEqual([]);
    expect(await store.loadGameSession("game-1")).not.toBeNull();
  });
});
