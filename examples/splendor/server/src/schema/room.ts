import {
  boolean,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { playerSessions } from "./player-session";

export const roomStatusEnum = pgEnum("room_status", ["open", "starting"]);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    status: roomStatusEnum("status").notNull().default("open"),
    hostPlayerSessionId: uuid("host_player_session_id")
      .notNull()
      .references(() => playerSessions.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_rooms_code").on(table.code),
    index("idx_rooms_host_player_session_id").on(table.hostPlayerSessionId),
  ],
);

export const roomPlayers = pgTable(
  "room_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    playerSessionId: uuid("player_session_id")
      .notNull()
      .references(() => playerSessions.id),
    seatIndex: smallint("seat_index").notNull(),
    displayName: text("display_name").notNull(),
    displayNameKey: text("display_name_key").notNull(),
    isReady: boolean("is_ready").notNull().default(false),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("room_players_room_player_session_unique").on(
      table.roomId,
      table.playerSessionId,
    ),
    unique("room_players_room_seat_unique").on(table.roomId, table.seatIndex),
    unique("room_players_room_display_name_key_unique").on(
      table.roomId,
      table.displayNameKey,
    ),
    index("idx_room_players_room_id").on(table.roomId),
    index("idx_room_players_player_session_id").on(table.playerSessionId),
    index("idx_room_players_disconnected_at").on(table.disconnectedAt),
  ],
);
