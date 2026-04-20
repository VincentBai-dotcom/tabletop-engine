import { AppError } from "../errors";
import { createRoomCode } from "../../lib/random";
import type {
  CreateRoomInput,
  CreateRoomResult,
  JoinRoomInput,
  JoinRoomResult,
  LeaveRoomInput,
  ResolvePlayerSession,
  RoomActionResult,
  RoomCodeGenerator,
  RoomNotifier,
  RoomPlayerSnapshot,
  RoomSnapshot,
  RoomStore,
  SetReadyInput,
  StartGameFromRoom,
  StartGameResult,
  StartRoomInput,
} from "./model";
import { MIN_PLAYERS_TO_START, ROOM_CAPACITY } from "./model";

export interface RoomService {
  createRoom(input: CreateRoomInput): Promise<CreateRoomResult>;
  joinRoom(input: JoinRoomInput): Promise<JoinRoomResult>;
  setReady(input: SetReadyInput): Promise<RoomActionResult>;
  leaveRoom(input: LeaveRoomInput): Promise<RoomActionResult>;
  startGame(input: StartRoomInput): Promise<StartGameResult>;
}

interface CreateRoomServiceDeps {
  store: RoomStore;
  resolveOrCreatePlayerSession: ResolvePlayerSession;
  roomCodeGenerator?: RoomCodeGenerator;
  notifier: RoomNotifier;
  startGameFromRoom?: StartGameFromRoom;
}

const NOOP_START_GAME: StartGameFromRoom = async () => ({
  gameSessionId: "pending-game-session",
});

export function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase();
}

export function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, " ");
}

export function createDisplayNameKey(displayName: string): string {
  return normalizeDisplayName(displayName).toLocaleLowerCase();
}

export function createRoomService({
  store,
  resolveOrCreatePlayerSession,
  roomCodeGenerator = createRoomCode,
  notifier,
  startGameFromRoom = NOOP_START_GAME,
}: CreateRoomServiceDeps): RoomService {
  async function createUniqueRoomCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = normalizeRoomCode(roomCodeGenerator());
      if (!(await store.roomCodeExists(code))) {
        return code;
      }
    }

    throw new AppError(
      "room_code_generation_failed",
      500,
      "Could not generate a unique room code",
    );
  }

  async function loadOpenRoom(roomId: string) {
    const room = await store.loadRoomSnapshot(roomId);
    if (!room) {
      throw new AppError("room_not_found", 404, "Room not found");
    }
    if (room.status !== "open") {
      throw new AppError("room_not_open", 409, "Room is not open");
    }
    return room;
  }

  function requireSeatedPlayer(
    room: RoomSnapshot,
    playerSessionId: string,
  ): RoomPlayerSnapshot {
    const player = room.players.find(
      (candidate) => candidate.playerSessionId === playerSessionId,
    );
    if (!player) {
      throw new AppError(
        "room_player_not_found",
        403,
        "Player is not seated in this room",
      );
    }
    return player;
  }

  function getNextOpenSeat(room: RoomSnapshot) {
    const occupiedSeats = new Set(
      room.players.map((player) => player.seatIndex),
    );
    for (let seatIndex = 0; seatIndex < ROOM_CAPACITY; seatIndex += 1) {
      if (!occupiedSeats.has(seatIndex)) {
        return seatIndex;
      }
    }

    throw new AppError("room_full", 409, "Room is full");
  }

  function assertDisplayNameAvailable(
    room: RoomSnapshot,
    displayNameKey: string,
  ) {
    if (
      room.players.some((player) => player.displayNameKey === displayNameKey)
    ) {
      throw new AppError(
        "display_name_taken",
        409,
        "Display name is already taken in this room",
      );
    }
  }

  return {
    async createRoom({ token, displayName }) {
      const session = await resolveOrCreatePlayerSession({ token });
      const normalizedDisplayName = normalizeDisplayName(displayName);
      const room = await store.createRoomWithHost({
        code: await createUniqueRoomCode(),
        hostPlayerSessionId: session.playerSessionId,
        displayName: normalizedDisplayName,
        displayNameKey: createDisplayNameKey(normalizedDisplayName),
      });

      return {
        playerSessionToken: session.token,
        room,
      };
    },

    async joinRoom({ token, roomCode, displayName }) {
      const room = await store.loadOpenRoomByCode(normalizeRoomCode(roomCode));
      if (!room) {
        throw new AppError("room_not_found", 404, "Room not found");
      }
      if (room.players.length >= ROOM_CAPACITY) {
        throw new AppError("room_full", 409, "Room is full");
      }

      const normalizedDisplayName = normalizeDisplayName(displayName);
      const displayNameKey = createDisplayNameKey(normalizedDisplayName);
      assertDisplayNameAvailable(room, displayNameKey);

      const session = await resolveOrCreatePlayerSession({ token });
      const nextSeat = getNextOpenSeat(room);
      const updatedRoom = await store.addRoomPlayer({
        roomId: room.id,
        playerSessionId: session.playerSessionId,
        seatIndex: nextSeat,
        displayName: normalizedDisplayName,
        displayNameKey,
      });

      await notifier.publishRoomUpdated(updatedRoom);

      return {
        playerSessionToken: session.token,
        room: updatedRoom,
      };
    },

    async setReady({ roomId, playerSessionId, ready }) {
      const room = await loadOpenRoom(roomId);
      requireSeatedPlayer(room, playerSessionId);

      const updatedRoom = await store.setRoomPlayerReady({
        roomId,
        playerSessionId,
        ready,
      });
      await notifier.publishRoomUpdated(updatedRoom);

      return {
        room: updatedRoom,
        roomDeleted: false,
      };
    },

    async leaveRoom({ roomId, playerSessionId }) {
      const room = await loadOpenRoom(roomId);
      const leavingPlayer = requireSeatedPlayer(room, playerSessionId);
      const roomAfterRemoval = await store.removeRoomPlayer({
        roomId,
        playerSessionId,
      });

      if (roomAfterRemoval.players.length === 0) {
        await store.deleteRoom(roomId);
        return {
          room: null,
          roomDeleted: true,
        };
      }

      const updatedRoom = leavingPlayer.isHost
        ? await store.updateRoomHost({
            roomId,
            playerSessionId: roomAfterRemoval.players[0]!.playerSessionId,
          })
        : roomAfterRemoval;

      await notifier.publishRoomUpdated(updatedRoom);

      return {
        room: updatedRoom,
        roomDeleted: false,
      };
    },

    async startGame({ roomId, playerSessionId }) {
      const room = await loadOpenRoom(roomId);
      const player = requireSeatedPlayer(room, playerSessionId);
      if (!player.isHost) {
        throw new AppError(
          "room_host_required",
          403,
          "Only the host can start the game",
        );
      }
      if (room.players.length < MIN_PLAYERS_TO_START) {
        throw new AppError(
          "room_needs_more_players",
          409,
          "At least two players are required to start",
        );
      }
      if (room.players.some((candidate) => !candidate.isReady)) {
        throw new AppError(
          "room_players_not_ready",
          409,
          "Every seated player must be ready before start",
        );
      }

      const startingRoom = await store.markRoomStarting(roomId);
      const { gameSessionId } = await startGameFromRoom({
        roomId,
        requestingPlayerSessionId: playerSessionId,
      });
      await notifier.publishGameStarted({ roomId, gameSessionId });

      return {
        room: startingRoom,
        gameSessionId,
      };
    },
  };
}
