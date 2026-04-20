import type { RoomNotifier, RoomSnapshot } from "../room";

export interface LiveConnection {
  id: string;
  send(payload: unknown): void;
}

export type LiveSubscription =
  | { type: "room"; roomId: string }
  | { type: "game"; gameSessionId: string };

export interface RemovedLiveConnection {
  playerSessionId: string;
  subscription: LiveSubscription | null;
}

export interface LiveConnectionRegistry {
  register(playerSessionId: string, connection: LiveConnection): void;
  getConnection(playerSessionId: string): LiveConnection | null;
  getPlayerSessionIdByConnectionId(connectionId: string): string | null;
  subscribeToRoom(playerSessionId: string, roomId: string): void;
  subscribeToGame(playerSessionId: string, gameSessionId: string): void;
  getRoomConnections(roomId: string): LiveConnection[];
  getGameConnections(gameSessionId: string): LiveConnection[];
  removeConnection(connectionId: string): RemovedLiveConnection | null;
}

export interface GameUpdatePayload {
  stateVersion: number;
  view: unknown;
  events: unknown[];
}

export interface GameEndedPayload {
  reason: "completed" | "invalidated";
  winnerPlayerIds?: string[];
  message?: string;
}

export interface GameSessionNotifier {
  publishGameUpdated(gameSessionId: string, payload: GameUpdatePayload): void;
  publishGameEnded(gameSessionId: string, payload: GameEndedPayload): void;
}

export interface LiveNotifier extends RoomNotifier, GameSessionNotifier {}

export type LiveServerMessage =
  | { type: "session_resolved"; playerSessionToken: string }
  | { type: "room_updated"; room: RoomSnapshot }
  | { type: "game_started"; gameSessionId: string }
  | ({ type: "game_updated" } & GameUpdatePayload)
  | { type: "game_ended"; result: GameEndedPayload }
  | { type: "error"; code: string; message?: string };

export type LiveClientMessage =
  | { type: "subscribe_room"; roomId: string }
  | { type: "room_set_ready"; roomId: string; ready: boolean }
  | { type: "room_leave"; roomId: string }
  | { type: "room_start_game"; roomId: string }
  | { type: "subscribe_game"; gameSessionId: string }
  | { type: "game_command"; gameSessionId: string; command: unknown };
