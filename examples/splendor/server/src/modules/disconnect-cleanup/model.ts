import type { Clock } from "../../lib/clock";
import type { GameSessionService } from "../game-session";
import type { RoomService } from "../room";
import type { LiveNotifier } from "../websocket";

export interface DisconnectCleanupService {
  runOnce(): Promise<{ roomsProcessed: number; gamesEnded: number }>;
}

export interface CreateDisconnectCleanupServiceDeps {
  clock: Clock;
  roomService: RoomService;
  gameSessionService: GameSessionService;
  notifier: LiveNotifier;
  disconnectGraceMs: number;
}
