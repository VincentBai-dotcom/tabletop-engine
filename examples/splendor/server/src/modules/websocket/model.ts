import type { RoomNotifier, RoomSnapshot } from "../room";

/** Transport-agnostic handle for a connected client. */
export interface LiveConnection {
  id: string;
  /** Send a JSON-serializable payload to the client. */
  send(payload: unknown): void;
  /** Send a protocol-level websocket ping when the runtime supports it. */
  ping?(): void;
  /** Force-close a stale connection when the runtime supports it. */
  terminate?(): void;
  /** Gracefully close a connection with an optional code and reason. */
  close?(code?: number, reason?: string): void;
}

/** What a connection is currently subscribed to. */
export type LiveSubscription =
  | { type: "room"; roomId: string }
  | { type: "game"; gameSessionId: string };

/** Returned when a connection is cleaned up on close. */
export interface RemovedLiveConnection {
  playerSessionId: string;
  subscription: LiveSubscription | null;
}

/**
 * In-memory registry that tracks active WebSocket connections and
 * their subscriptions. Each player session has at most one connection.
 * Connections subscribe to either a room or a game session at a time.
 */
export interface LiveConnectionRegistry {
  /** Associate a WebSocket connection with a player session. Replaces any existing connection. */
  register(playerSessionId: string, connection: LiveConnection): void;
  /** Look up the connection for a player session. */
  getConnection(playerSessionId: string): LiveConnection | null;
  /** Reverse lookup: find which player session owns a connection. */
  getPlayerSessionIdByConnectionId(connectionId: string): string | null;
  /** Get a player's connection only if they are subscribed to the given game. */
  getGameConnectionForPlayer(
    playerSessionId: string,
    gameSessionId: string,
  ): LiveConnection | null;
  /** Subscribe a player's connection to room updates (replaces any prior subscription). */
  subscribeToRoom(playerSessionId: string, roomId: string): void;
  /** Subscribe a player's connection to game updates (replaces any prior subscription). */
  subscribeToGame(playerSessionId: string, gameSessionId: string): void;
  /** Get all connections currently subscribed to a room. */
  getRoomConnections(roomId: string): LiveConnection[];
  /** Get all connections currently subscribed to a game session. */
  getGameConnections(gameSessionId: string): LiveConnection[];
  /** Get every registered live connection. */
  getConnections(): LiveConnection[];
  /** Unregister a connection on close. Returns the player session and last subscription for cleanup. */
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

/**
 * Broadcasts game state changes to subscribed WebSocket clients.
 */
export interface GameSessionNotifier {
  /** Send updated per-player views to all game subscribers. */
  publishGameUpdated(gameSessionId: string, payload: GameUpdatePayload): void;
  /** Notify all game subscribers that the game has ended. */
  publishGameEnded(gameSessionId: string, payload: GameEndedPayload): void;
}

/** Combined notifier for both room and game session events. */
export interface LiveNotifier extends RoomNotifier, GameSessionNotifier {}

/** Messages sent from the server to the client over WebSocket. */
export type LiveServerMessage =
  | { type: "session_resolved"; playerSessionToken: string }
  | { type: "room_snapshot"; room: RoomSnapshot }
  | { type: "room_updated"; room: RoomSnapshot }
  | { type: "game_started"; gameSessionId: string }
  | { type: "game_snapshot"; stateVersion: number; view: unknown; events: [] }
  | ({ type: "game_updated" } & GameUpdatePayload)
  | { type: "game_ended"; result: GameEndedPayload }
  | {
      type: "player_disconnected";
      playerSessionId: string;
      graceExpiresAt: string;
    }
  | { type: "player_reconnected"; playerSessionId: string }
  | { type: "server_restarting"; reconnectAfterMs: number }
  | { type: "error"; code: string; message?: string };

/** Messages sent from the client to the server over WebSocket. */
export type LiveClientMessage =
  | { type: "subscribe_room"; roomId: string }
  | { type: "room_set_ready"; roomId: string; ready: boolean }
  | { type: "room_leave"; roomId: string }
  | { type: "room_start_game"; roomId: string }
  | { type: "subscribe_game"; gameSessionId: string }
  | { type: "game_command"; gameSessionId: string; command: unknown };
