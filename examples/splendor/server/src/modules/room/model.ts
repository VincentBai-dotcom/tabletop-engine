import type {
  ResolvePlayerSessionInput,
  ResolvePlayerSessionResult,
} from "../player-session";

export const ROOM_CAPACITY = 4;
export const MIN_PLAYERS_TO_START = 2;

export type RoomStatus = "open" | "starting";

/** A player seated in a room lobby. */
export interface RoomPlayerSnapshot {
  playerSessionId: string;
  seatIndex: number;
  displayName: string;
  displayNameKey: string;
  isReady: boolean;
  isHost: boolean;
  disconnectedAt: Date | null;
}

/** Point-in-time view of a room and its seated players. */
export interface RoomSnapshot {
  id: string;
  code: string;
  status: RoomStatus;
  hostPlayerSessionId: string;
  players: RoomPlayerSnapshot[];
}

export interface CreateRoomInput {
  token?: string | null;
  displayName: string;
}

export interface JoinRoomInput {
  token?: string | null;
  roomCode: string;
  displayName: string;
}

export interface CreateRoomResult {
  playerSessionToken: string;
  room: RoomSnapshot;
}

export type JoinRoomResult = CreateRoomResult;

export interface SetReadyInput {
  roomId: string;
  playerSessionId: string;
  ready: boolean;
}

export interface LeaveRoomInput {
  roomId: string;
  playerSessionId: string;
}

export interface StartRoomInput {
  roomId: string;
  playerSessionId: string;
}

export interface RoomActionResult {
  room: RoomSnapshot | null;
  roomDeleted: boolean;
}

export interface StartGameResult {
  room: RoomSnapshot;
  gameSessionId: string;
}

export interface CreateRoomWithHostInput {
  code: string;
  hostPlayerSessionId: string;
  displayName: string;
  displayNameKey: string;
}

/**
 * Persistence layer for room lifecycle.
 * All mutating methods return the updated room snapshot.
 */
export interface RoomStore {
  /** Check whether a room code is already in use. */
  roomCodeExists(code: string): Promise<boolean>;
  /** Create a new room and seat the host at index 0 (transactional). */
  createRoomWithHost(input: CreateRoomWithHostInput): Promise<RoomSnapshot>;
  /** Find an open room by its short join code. Returns null if not found or not open. */
  loadOpenRoomByCode(code: string): Promise<RoomSnapshot | null>;
  /** Load a room by id regardless of status. */
  loadRoomSnapshot(roomId: string): Promise<RoomSnapshot | null>;
  /** Add a player to an existing room at the given seat. */
  addRoomPlayer(input: {
    roomId: string;
    playerSessionId: string;
    seatIndex: number;
    displayName: string;
    displayNameKey: string;
  }): Promise<RoomSnapshot>;
  /** Toggle a seated player's ready flag. */
  setRoomPlayerReady(input: {
    roomId: string;
    playerSessionId: string;
    ready: boolean;
  }): Promise<RoomSnapshot>;
  /** Mark a seated player as temporarily disconnected. */
  markRoomPlayerDisconnected(input: {
    roomId: string;
    playerSessionId: string;
    disconnectedAt: Date;
  }): Promise<RoomSnapshot>;
  /** Clear a seated player's temporary disconnect marker. */
  clearRoomPlayerDisconnected(input: {
    roomId: string;
    playerSessionId: string;
  }): Promise<RoomSnapshot>;
  /** Find disconnected room players whose grace window has expired. */
  loadExpiredDisconnectedRoomPlayers(input: {
    olderThan: Date;
  }): Promise<Array<{ roomId: string; playerSessionId: string }>>;
  /** Remove a player from the room. */
  removeRoomPlayer(input: {
    roomId: string;
    playerSessionId: string;
  }): Promise<RoomSnapshot>;
  /** Delete a room and its players (cascade). */
  deleteRoom(roomId: string): Promise<void>;
  /** Transfer host role to another seated player. */
  updateRoomHost(input: {
    roomId: string;
    playerSessionId: string;
  }): Promise<RoomSnapshot>;
  /** Transition the room status to "starting" before game creation. */
  markRoomStarting(roomId: string): Promise<RoomSnapshot>;
}

/**
 * Push-based notifier for broadcasting room state changes
 * to connected WebSocket clients.
 */
export interface RoomNotifier {
  /** Broadcast an updated room snapshot to all room subscribers. */
  publishRoomUpdated(room: RoomSnapshot): void | Promise<void>;
  /** Notify room subscribers that a game session has been created. */
  publishGameStarted(payload: {
    roomId: string;
    gameSessionId: string;
  }): void | Promise<void>;
}

export type ResolvePlayerSession = (
  input: ResolvePlayerSessionInput,
) => Promise<ResolvePlayerSessionResult>;

export type RoomCodeGenerator = () => string;

export type StartGameFromRoom = (input: {
  roomId: string;
  requestingPlayerSessionId: string;
}) => Promise<{ gameSessionId: string }>;

/**
 * Application-level room service.
 * Manages the full room lifecycle: creation, joining, readiness, leaving, and game start.
 */
export interface RoomService {
  /** Create a new room with the requesting player seated as host. */
  createRoom(input: CreateRoomInput): Promise<CreateRoomResult>;
  /** Join an existing open room by its short code. */
  joinRoom(input: JoinRoomInput): Promise<JoinRoomResult>;
  /** Toggle a seated player's ready flag and broadcast the update. */
  setReady(input: SetReadyInput): Promise<RoomActionResult>;
  /** Mark a seated player temporarily disconnected without freeing their seat. */
  markDisconnected(input: {
    roomId: string;
    playerSessionId: string;
    disconnectedAt: Date;
  }): Promise<RoomActionResult>;
  /** Clear a temporary disconnect marker after the player reconnects. */
  markReconnected(input: {
    roomId: string;
    playerSessionId: string;
  }): Promise<RoomActionResult>;
  /** Remove disconnected room players whose grace window has expired. */
  cleanupExpiredDisconnects(input: { olderThan: Date }): Promise<number>;
  /** Remove a player from the room. Deletes the room if it becomes empty, or transfers host. */
  leaveRoom(input: LeaveRoomInput): Promise<RoomActionResult>;
  /** Start the game if the requesting player is the host and all players are ready. */
  startGame(input: StartRoomInput): Promise<StartGameResult>;
}
