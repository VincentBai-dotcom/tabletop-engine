import type { Clock } from "../../lib/clock";
import type { GameSessionService } from "../game-session";
import type { RoomService } from "../room";
import type { LiveServerMessage, LiveSubscription } from "../websocket";

export interface ClosedSubscriptionInput {
  playerSessionId: string;
  subscription: LiveSubscription | null;
}

export interface LivePresenceService {
  handleClosedSubscription(input: ClosedSubscriptionInput): Promise<void>;
  handleRoomSubscribed(input: {
    playerSessionId: string;
    roomId: string;
  }): Promise<LiveServerMessage>;
  handleGameSubscribed(input: {
    playerSessionId: string;
    gameSessionId: string;
  }): Promise<LiveServerMessage>;
}

export interface CreateLivePresenceServiceDeps {
  clock: Clock;
  roomService: RoomService;
  gameSessionService?: GameSessionService;
}
