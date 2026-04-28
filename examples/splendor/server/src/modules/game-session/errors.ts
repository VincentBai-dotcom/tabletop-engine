import { AppError } from "../errors";

export const GameSessionErrorCodes = {
  InvalidGameCommand: "INVALID_GAME_COMMAND",
  InvalidGameDiscovery: "INVALID_GAME_DISCOVERY",
  GameNotFound: "GAME_NOT_FOUND",
  GamePlayerNotFound: "GAME_PLAYER_NOT_FOUND",
  RoomNotFound: "ROOM_NOT_FOUND",
  RoomHostRequired: "ROOM_HOST_REQUIRED",
} as const;

export class GameSessionError extends AppError {
  static invalidGameCommand(message: string) {
    return new GameSessionError(
      GameSessionErrorCodes.InvalidGameCommand,
      400,
      message,
    );
  }

  static invalidGameDiscovery(message: string) {
    return new GameSessionError(
      GameSessionErrorCodes.InvalidGameDiscovery,
      400,
      message,
    );
  }

  static gameNotFound() {
    return new GameSessionError(
      GameSessionErrorCodes.GameNotFound,
      404,
      "Game session not found",
    );
  }

  static gamePlayerNotFound() {
    return new GameSessionError(
      GameSessionErrorCodes.GamePlayerNotFound,
      403,
      "Player is not seated in this game",
    );
  }

  static roomNotFound() {
    return new GameSessionError(
      GameSessionErrorCodes.RoomNotFound,
      404,
      "Room not found",
    );
  }

  static roomHostRequired() {
    return new GameSessionError(
      GameSessionErrorCodes.RoomHostRequired,
      403,
      "Only the host can start the game",
    );
  }

  constructor(
    code: string,
    statusCode: number,
    message: string,
    details?: unknown,
  ) {
    super(code, statusCode, message, details);
    this.name = "GameSessionError";
  }
}
