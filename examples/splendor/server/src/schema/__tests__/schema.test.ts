import { describe, expect, it } from "bun:test";
import { getTableName } from "drizzle-orm";
import {
  gameSessionPlayers,
  gameSessions,
  playerSessions,
  roomPlayers,
  rooms,
} from "../index";

describe("database schema", () => {
  it("exports the hosted Splendor lifecycle tables", () => {
    expect(getTableName(playerSessions)).toBe("player_sessions");
    expect(getTableName(rooms)).toBe("rooms");
    expect(getTableName(roomPlayers)).toBe("room_players");
    expect(getTableName(gameSessions)).toBe("game_sessions");
    expect(getTableName(gameSessionPlayers)).toBe("game_session_players");
  });

  it("tracks temporary room disconnects", () => {
    expect(roomPlayers.disconnectedAt).toBeDefined();
  });
});
