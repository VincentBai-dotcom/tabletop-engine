import type {
  ResolvePlayerSessionInput,
  ResolvePlayerSessionResult,
} from "../session";

export const ROOM_CAPACITY = 4;
export const MIN_PLAYERS_TO_START = 2;

export type RoomStatus = "open" | "starting";

export interface RoomPlayerSnapshot {
  playerSessionId: string;
  seatIndex: number;
  displayName: string;
  displayNameKey: string;
  isReady: boolean;
  isHost: boolean;
}

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

export interface RoomStore {
  roomCodeExists(code: string): Promise<boolean>;
  createRoomWithHost(input: CreateRoomWithHostInput): Promise<RoomSnapshot>;
  loadOpenRoomByCode(code: string): Promise<RoomSnapshot | null>;
  loadRoomSnapshot(roomId: string): Promise<RoomSnapshot | null>;
  addRoomPlayer(input: {
    roomId: string;
    playerSessionId: string;
    seatIndex: number;
    displayName: string;
    displayNameKey: string;
  }): Promise<RoomSnapshot>;
  setRoomPlayerReady(input: {
    roomId: string;
    playerSessionId: string;
    ready: boolean;
  }): Promise<RoomSnapshot>;
  removeRoomPlayer(input: {
    roomId: string;
    playerSessionId: string;
  }): Promise<RoomSnapshot>;
  deleteRoom(roomId: string): Promise<void>;
  updateRoomHost(input: {
    roomId: string;
    playerSessionId: string;
  }): Promise<RoomSnapshot>;
  markRoomStarting(roomId: string): Promise<RoomSnapshot>;
}

export interface RoomNotifier {
  publishRoomUpdated(room: RoomSnapshot): void | Promise<void>;
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
