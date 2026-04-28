import { AppError } from "../errors";

export const WebSocketErrorCodes = {
  LiveConnectionNotRegistered: "LIVE_CONNECTION_NOT_REGISTERED",
  GameCommandsNotImplemented: "GAME_COMMANDS_NOT_IMPLEMENTED",
} as const;

export class WebSocketError extends AppError {
  static liveConnectionNotRegistered() {
    return new WebSocketError(
      WebSocketErrorCodes.LiveConnectionNotRegistered,
      401,
      "Live connection is not registered",
    );
  }

  static gameCommandsNotImplemented() {
    return new WebSocketError(
      WebSocketErrorCodes.GameCommandsNotImplemented,
      501,
      "Game commands are not implemented yet",
    );
  }

  constructor(
    code: string,
    statusCode: number,
    message: string,
    details?: unknown,
  ) {
    super(code, statusCode, message, details);
    this.name = "WebSocketError";
  }
}
