import { and, asc, eq } from "drizzle-orm";
import type { CanonicalState } from "tabletop-engine";
import type { Db } from "../db";
import {
  gameSessionPlayers,
  gameSessions,
  roomPlayers,
  rooms,
} from "../../schema";
import type { RoomPlayerSnapshot, RoomSnapshot } from "../room";
import type {
  CreateGameSessionInput,
  GameSessionPlayerSnapshot,
  GameSessionSnapshot,
  GameSessionStore,
} from "./model";

type RoomRow = typeof rooms.$inferSelect;
type RoomPlayerRow = typeof roomPlayers.$inferSelect;
type GameSessionRow = typeof gameSessions.$inferSelect;
type GameSessionPlayerRow = typeof gameSessionPlayers.$inferSelect;

function mapRoomSnapshot(
  room: RoomRow,
  players: RoomPlayerRow[],
): RoomSnapshot {
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    hostPlayerSessionId: room.hostPlayerSessionId,
    players: players.map(
      (player): RoomPlayerSnapshot => ({
        playerSessionId: player.playerSessionId,
        seatIndex: player.seatIndex,
        displayName: player.displayName,
        displayNameKey: player.displayNameKey,
        isReady: player.isReady,
        isHost: player.playerSessionId === room.hostPlayerSessionId,
      }),
    ),
  };
}

function mapGameSessionSnapshot<TState extends CanonicalState<object>>(
  gameSession: GameSessionRow,
  players: GameSessionPlayerRow[],
): GameSessionSnapshot<TState> {
  return {
    id: gameSession.id,
    canonicalState: gameSession.canonicalState as TState,
    stateVersion: gameSession.stateVersion,
    players: players.map(
      (player): GameSessionPlayerSnapshot => ({
        playerSessionId: player.playerSessionId,
        playerId: player.playerId,
        seatIndex: player.seatIndex,
        displayName: player.displayName,
        disconnectedAt: player.disconnectedAt,
      }),
    ),
  };
}

async function loadGameSessionSnapshot<TState extends CanonicalState<object>>(
  db: Db,
  gameSessionId: string,
): Promise<GameSessionSnapshot<TState> | null> {
  const [gameSession] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.id, gameSessionId))
    .limit(1);
  if (!gameSession) {
    return null;
  }

  const players = await db
    .select()
    .from(gameSessionPlayers)
    .where(eq(gameSessionPlayers.gameSessionId, gameSessionId))
    .orderBy(asc(gameSessionPlayers.seatIndex));

  return mapGameSessionSnapshot(gameSession, players);
}

export function createGameSessionStore<TState extends CanonicalState<object>>(
  db: Db,
): GameSessionStore<TState> {
  return {
    async loadRoomForGameStart(roomId) {
      const [room] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);
      if (!room) {
        return null;
      }

      const players = await db
        .select()
        .from(roomPlayers)
        .where(eq(roomPlayers.roomId, roomId))
        .orderBy(asc(roomPlayers.seatIndex));

      return mapRoomSnapshot(room, players);
    },

    async createGameSession(input: CreateGameSessionInput<TState>) {
      const [gameSession] = await db
        .insert(gameSessions)
        .values({
          canonicalState: input.canonicalState,
          stateVersion: 0,
        })
        .returning();

      if (!gameSession) {
        throw new Error("game_session_insert_failed");
      }

      if (input.players.length > 0) {
        await db.insert(gameSessionPlayers).values(
          input.players.map((player) => ({
            gameSessionId: gameSession.id,
            playerSessionId: player.playerSessionId,
            playerId: player.playerId,
            seatIndex: player.seatIndex,
            displayName: player.displayName,
          })),
        );
      }

      const snapshot = await loadGameSessionSnapshot<TState>(
        db,
        gameSession.id,
      );
      if (!snapshot) {
        throw new Error("game_session_snapshot_missing_after_insert");
      }
      return snapshot;
    },

    async loadGameSession(gameSessionId) {
      return loadGameSessionSnapshot<TState>(db, gameSessionId);
    },

    async persistAcceptedCommandResult(input) {
      await db
        .update(gameSessions)
        .set({
          canonicalState: input.canonicalState,
          stateVersion: input.stateVersion,
          updatedAt: new Date(),
        })
        .where(eq(gameSessions.id, input.gameSessionId));

      const snapshot = await loadGameSessionSnapshot<TState>(
        db,
        input.gameSessionId,
      );
      if (!snapshot) {
        throw new Error("game_session_snapshot_missing_after_persist");
      }
      return snapshot;
    },

    async deleteRoom(roomId) {
      await db.delete(rooms).where(eq(rooms.id, roomId));
    },

    async deleteGameSession(gameSessionId) {
      await db.delete(gameSessions).where(eq(gameSessions.id, gameSessionId));
    },

    async markPlayerDisconnected(input) {
      await db
        .update(gameSessionPlayers)
        .set({ disconnectedAt: input.disconnectedAt })
        .where(
          and(
            eq(gameSessionPlayers.gameSessionId, input.gameSessionId),
            eq(gameSessionPlayers.playerSessionId, input.playerSessionId),
          ),
        );

      return loadGameSessionSnapshot<TState>(db, input.gameSessionId);
    },
  };
}
