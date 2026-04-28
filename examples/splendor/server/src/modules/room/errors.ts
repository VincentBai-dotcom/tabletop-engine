import { AppError } from "../errors";

export const RoomErrorCodes = {
  RoomCodeGenerationFailed: "ROOM_CODE_GENERATION_FAILED",
  RoomNotFound: "ROOM_NOT_FOUND",
  RoomNotOpen: "ROOM_NOT_OPEN",
  RoomPlayerNotFound: "ROOM_PLAYER_NOT_FOUND",
  RoomFull: "ROOM_FULL",
  DisplayNameTaken: "DISPLAY_NAME_TAKEN",
  RoomHostRequired: "ROOM_HOST_REQUIRED",
  RoomNeedsMorePlayers: "ROOM_NEEDS_MORE_PLAYERS",
  RoomPlayersNotReady: "ROOM_PLAYERS_NOT_READY",
  RoomPlayersDisconnected: "ROOM_PLAYERS_DISCONNECTED",
} as const;

export class RoomError extends AppError {
  static roomCodeGenerationFailed() {
    return new RoomError(
      RoomErrorCodes.RoomCodeGenerationFailed,
      500,
      "Could not generate a unique room code",
    );
  }

  static roomNotFound() {
    return new RoomError(RoomErrorCodes.RoomNotFound, 404, "Room not found");
  }

  static roomNotOpen() {
    return new RoomError(RoomErrorCodes.RoomNotOpen, 409, "Room is not open");
  }

  static roomPlayerNotFound() {
    return new RoomError(
      RoomErrorCodes.RoomPlayerNotFound,
      403,
      "Player is not seated in this room",
    );
  }

  static roomFull() {
    return new RoomError(RoomErrorCodes.RoomFull, 409, "Room is full");
  }

  static displayNameTaken() {
    return new RoomError(
      RoomErrorCodes.DisplayNameTaken,
      409,
      "Display name is already taken in this room",
    );
  }

  static roomHostRequired() {
    return new RoomError(
      RoomErrorCodes.RoomHostRequired,
      403,
      "Only the host can start the game",
    );
  }

  static roomNeedsMorePlayers() {
    return new RoomError(
      RoomErrorCodes.RoomNeedsMorePlayers,
      409,
      "At least two players are required to start",
    );
  }

  static roomPlayersNotReady() {
    return new RoomError(
      RoomErrorCodes.RoomPlayersNotReady,
      409,
      "Every seated player must be ready before start",
    );
  }

  static roomPlayersDisconnected() {
    return new RoomError(
      RoomErrorCodes.RoomPlayersDisconnected,
      409,
      "Every seated player must be connected before start",
    );
  }

  constructor(
    code: string,
    statusCode: number,
    message: string,
    details?: unknown,
  ) {
    super(code, statusCode, message, details);
    this.name = "RoomError";
  }
}
