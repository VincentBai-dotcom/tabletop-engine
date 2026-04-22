import { describe, expect, it } from "bun:test";
import type { LivePresenceService } from "../../live-presence";
import { createLiveConnectionRegistry } from "../registry";
import { handleLiveConnectionClosed } from "../routes";

describe("websocket route lifecycle", () => {
  it("marks the removed subscription disconnected when a live connection closes", async () => {
    const registry = createLiveConnectionRegistry();
    const calls: unknown[] = [];
    const livePresenceService = {
      async handleClosedSubscription(input) {
        calls.push(input);
      },
      async handleRoomSubscribed() {
        throw new Error("not used");
      },
      async handleGameSubscribed() {
        throw new Error("not used");
      },
    } satisfies LivePresenceService;

    registry.register("session-1", { id: "conn-1", send() {} });
    registry.subscribeToRoom("session-1", "room-1");

    await handleLiveConnectionClosed({
      registry,
      livePresenceService,
      connectionId: "conn-1",
    });

    expect(calls).toEqual([
      {
        playerSessionId: "session-1",
        subscription: { type: "room", roomId: "room-1" },
      },
    ]);
    expect(registry.getConnection("session-1")).toBeNull();
  });
});
