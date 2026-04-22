import { AppError } from "../errors";
import type {
  CreateLivePresenceServiceDeps,
  LivePresenceService,
} from "./model";

export function createLivePresenceService({
  clock,
  roomService,
  gameSessionService,
}: CreateLivePresenceServiceDeps): LivePresenceService {
  function requireGameSessionService() {
    if (!gameSessionService) {
      throw new AppError(
        "game_presence_not_implemented",
        501,
        "Game presence is not implemented yet",
      );
    }
    return gameSessionService;
  }

  return {
    async handleClosedSubscription({ playerSessionId, subscription }) {
      if (!subscription) {
        return;
      }

      if (subscription.type === "room") {
        await roomService.markDisconnected({
          roomId: subscription.roomId,
          playerSessionId,
          disconnectedAt: clock.now(),
        });
        return;
      }

      await requireGameSessionService().markDisconnected({
        gameSessionId: subscription.gameSessionId,
        playerSessionId,
      });
    },

    async handleRoomSubscribed({ playerSessionId, roomId }) {
      const result = await roomService.markReconnected({
        roomId,
        playerSessionId,
      });
      if (!result.room) {
        throw new AppError("room_not_found", 404, "Room not found");
      }

      return {
        type: "room_snapshot",
        room: result.room,
      };
    },

    async handleGameSubscribed({ playerSessionId, gameSessionId }) {
      const snapshot = await requireGameSessionService().markReconnected({
        gameSessionId,
        playerSessionId,
      });
      if (!snapshot) {
        throw new AppError("game_not_found", 404, "Game session not found");
      }

      return {
        type: "game_snapshot",
        stateVersion: snapshot.stateVersion,
        view: snapshot.view,
        events: [],
      };
    },
  };
}
