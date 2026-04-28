import { AppError } from "../errors";

export const LivePresenceErrorCodes = {
  GamePresenceNotImplemented: "GAME_PRESENCE_NOT_IMPLEMENTED",
  RoomNotFound: "ROOM_NOT_FOUND",
  GameNotFound: "GAME_NOT_FOUND",
} as const;

export class LivePresenceError extends AppError {
  static gamePresenceNotImplemented() {
    return new LivePresenceError(
      LivePresenceErrorCodes.GamePresenceNotImplemented,
      501,
      "Game presence is not implemented yet",
    );
  }

  static roomNotFound() {
    return new LivePresenceError(
      LivePresenceErrorCodes.RoomNotFound,
      404,
      "Room not found",
    );
  }

  static gameNotFound() {
    return new LivePresenceError(
      LivePresenceErrorCodes.GameNotFound,
      404,
      "Game session not found",
    );
  }

  constructor(
    code: string,
    statusCode: number,
    message: string,
    details?: unknown,
  ) {
    super(code, statusCode, message, details);
    this.name = "LivePresenceError";
  }
}
