import { subtractMilliseconds } from "../../lib/time";
import type {
  CreateDisconnectCleanupServiceDeps,
  DisconnectCleanupService,
} from "./model";

export function createDisconnectCleanupService({
  clock,
  roomService,
  gameSessionService,
  notifier,
  disconnectGraceMs,
}: CreateDisconnectCleanupServiceDeps): DisconnectCleanupService {
  return {
    async runOnce() {
      const olderThan = subtractMilliseconds(clock.now(), disconnectGraceMs);
      const roomsProcessed = await roomService.cleanupExpiredDisconnects({
        olderThan,
      });
      const endedGames = await gameSessionService.cleanupExpiredDisconnects({
        olderThan,
      });

      for (const ended of endedGames) {
        notifier.publishGameEnded(ended.gameSessionId, ended.result);
      }

      return {
        roomsProcessed,
        gamesEnded: endedGames.length,
      };
    },
  };
}
