import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { playerSessions } from "../../schema";
import type { PlayerSessionRecord, PlayerSessionStore } from "./model";

function mapPlayerSessionRecord(
  record: typeof playerSessions.$inferSelect,
): PlayerSessionRecord {
  return {
    id: record.id,
    tokenHash: record.tokenHash,
    createdAt: record.createdAt,
    lastSeenAt: record.lastSeenAt,
  };
}

export function createPlayerSessionStore(db: Db): PlayerSessionStore {
  return {
    async findByTokenHash(tokenHash) {
      const [record] = await db
        .select()
        .from(playerSessions)
        .where(eq(playerSessions.tokenHash, tokenHash))
        .limit(1);

      return record ? mapPlayerSessionRecord(record) : null;
    },

    async insert({ tokenHash, now }) {
      const [record] = await db
        .insert(playerSessions)
        .values({
          tokenHash,
          createdAt: now,
          lastSeenAt: now,
        })
        .returning();

      if (!record) {
        throw new Error("player_session_insert_failed");
      }

      return mapPlayerSessionRecord(record);
    },

    async touch({ id, now }) {
      await db
        .update(playerSessions)
        .set({ lastSeenAt: now })
        .where(eq(playerSessions.id, id));
    },
  };
}
