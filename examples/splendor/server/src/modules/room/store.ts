import { and, asc, eq, type SQL } from "drizzle-orm";
import type { Db } from "../db";
import { roomPlayers, rooms } from "../../schema";
import type {
  CreateRoomWithHostInput,
  RoomPlayerSnapshot,
  RoomSnapshot,
  RoomStore,
} from "./model";

type RoomRow = typeof rooms.$inferSelect;
type RoomPlayerRow = typeof roomPlayers.$inferSelect;

export function mapRoomSnapshot(
  room: RoomRow,
  players: RoomPlayerRow[],
): RoomSnapshot {
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    hostPlayerSessionId: room.hostPlayerSessionId,
    players: players.map((player): RoomPlayerSnapshot => {
      const isHost = player.playerSessionId === room.hostPlayerSessionId;

      return {
        playerSessionId: player.playerSessionId,
        seatIndex: player.seatIndex,
        displayName: player.displayName,
        displayNameKey: player.displayNameKey,
        isReady: player.isReady,
        isHost,
      };
    }),
  };
}

async function loadRoomSnapshot(
  db: Db,
  filter: SQL,
): Promise<RoomSnapshot | null> {
  const rows = await db
    .select()
    .from(rooms)
    .leftJoin(roomPlayers, eq(rooms.id, roomPlayers.roomId))
    .where(filter)
    .orderBy(asc(roomPlayers.seatIndex));

  if (rows.length === 0) {
    return null;
  }

  const room = rows[0]!.rooms;
  const players = rows
    .map((row) => row.room_players)
    .filter((player): player is RoomPlayerRow => player !== null);

  return mapRoomSnapshot(room, players);
}

export function createRoomStore(db: Db): RoomStore {
  return {
    async roomCodeExists(code) {
      const [room] = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(eq(rooms.code, code))
        .limit(1);

      return Boolean(room);
    },

    async createRoomWithHost(input: CreateRoomWithHostInput) {
      return db.transaction(async (tx) => {
        const [room] = await tx
          .insert(rooms)
          .values({
            code: input.code,
            hostPlayerSessionId: input.hostPlayerSessionId,
          })
          .returning();

        if (!room) {
          throw new Error("room_insert_failed");
        }

        const [player] = await tx
          .insert(roomPlayers)
          .values({
            roomId: room.id,
            playerSessionId: input.hostPlayerSessionId,
            seatIndex: 0,
            displayName: input.displayName,
            displayNameKey: input.displayNameKey,
          })
          .returning();

        if (!player) {
          throw new Error("room_host_insert_failed");
        }

        return mapRoomSnapshot(room, [player]);
      });
    },

    async loadOpenRoomByCode(code) {
      const snapshot = await loadRoomSnapshot(
        db,
        and(eq(rooms.code, code), eq(rooms.status, "open"))!,
      );
      return snapshot;
    },

    async loadRoomSnapshot(roomId) {
      return loadRoomSnapshot(db, eq(rooms.id, roomId));
    },

    async addRoomPlayer(input) {
      await db.insert(roomPlayers).values({
        roomId: input.roomId,
        playerSessionId: input.playerSessionId,
        seatIndex: input.seatIndex,
        displayName: input.displayName,
        displayNameKey: input.displayNameKey,
      });

      const room = await loadRoomSnapshot(db, eq(rooms.id, input.roomId));
      if (!room) {
        throw new Error("room_snapshot_missing_after_add_player");
      }
      return room;
    },

    async setRoomPlayerReady(input) {
      await db
        .update(roomPlayers)
        .set({ isReady: input.ready })
        .where(
          and(
            eq(roomPlayers.roomId, input.roomId),
            eq(roomPlayers.playerSessionId, input.playerSessionId),
          ),
        );

      const room = await loadRoomSnapshot(db, eq(rooms.id, input.roomId));
      if (!room) {
        throw new Error("room_snapshot_missing_after_ready");
      }
      return room;
    },

    async removeRoomPlayer(input) {
      await db
        .delete(roomPlayers)
        .where(
          and(
            eq(roomPlayers.roomId, input.roomId),
            eq(roomPlayers.playerSessionId, input.playerSessionId),
          ),
        );

      const room = await loadRoomSnapshot(db, eq(rooms.id, input.roomId));
      if (!room) {
        throw new Error("room_snapshot_missing_after_remove_player");
      }
      return room;
    },

    async deleteRoom(roomId) {
      await db.delete(rooms).where(eq(rooms.id, roomId));
    },

    async updateRoomHost(input) {
      await db
        .update(rooms)
        .set({ hostPlayerSessionId: input.playerSessionId })
        .where(eq(rooms.id, input.roomId));

      const room = await loadRoomSnapshot(db, eq(rooms.id, input.roomId));
      if (!room) {
        throw new Error("room_snapshot_missing_after_host_update");
      }
      return room;
    },

    async markRoomStarting(roomId) {
      await db
        .update(rooms)
        .set({ status: "starting" })
        .where(eq(rooms.id, roomId));

      const room = await loadRoomSnapshot(db, eq(rooms.id, roomId));
      if (!room) {
        throw new Error("room_snapshot_missing_after_starting");
      }
      return room;
    },
  };
}
