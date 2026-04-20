import { describe, expect, it } from "bun:test";
import { createLiveConnectionRegistry } from "../registry";
import type { LiveConnection } from "../model";

function createConnection(id: string): LiveConnection {
  return {
    id,
    send() {},
  };
}

describe("createLiveConnectionRegistry", () => {
  it("registers a connection by player session id", () => {
    const registry = createLiveConnectionRegistry();
    const connection = createConnection("conn-1");

    registry.register("session-1", connection);

    expect(registry.getConnection("session-1")).toBe(connection);
    expect(registry.getPlayerSessionIdByConnectionId("conn-1")).toBe(
      "session-1",
    );
  });

  it("replaces an existing connection for the same player session", () => {
    const registry = createLiveConnectionRegistry();
    const oldConnection = createConnection("conn-1");
    const newConnection = createConnection("conn-2");

    registry.register("session-1", oldConnection);
    registry.subscribeToRoom("session-1", "room-1");
    registry.register("session-1", newConnection);

    expect(registry.getConnection("session-1")).toBe(newConnection);
    expect(registry.getRoomConnections("room-1")).toEqual([]);
  });

  it("subscribes a connection to a room", () => {
    const registry = createLiveConnectionRegistry();
    const connection = createConnection("conn-1");

    registry.register("session-1", connection);
    registry.subscribeToRoom("session-1", "room-1");

    expect(registry.getRoomConnections("room-1")).toEqual([connection]);
  });

  it("switches a subscription from room to game session", () => {
    const registry = createLiveConnectionRegistry();
    const connection = createConnection("conn-1");

    registry.register("session-1", connection);
    registry.subscribeToRoom("session-1", "room-1");
    registry.subscribeToGame("session-1", "game-1");

    expect(registry.getRoomConnections("room-1")).toEqual([]);
    expect(registry.getGameConnections("game-1")).toEqual([connection]);
  });

  it("removes a connection on close", () => {
    const registry = createLiveConnectionRegistry();
    const connection = createConnection("conn-1");

    registry.register("session-1", connection);
    registry.subscribeToRoom("session-1", "room-1");
    const removed = registry.removeConnection("conn-1");

    expect(removed).toEqual({
      playerSessionId: "session-1",
      subscription: { type: "room", roomId: "room-1" },
    });
    expect(registry.getConnection("session-1")).toBeNull();
    expect(registry.getRoomConnections("room-1")).toEqual([]);
  });
});
