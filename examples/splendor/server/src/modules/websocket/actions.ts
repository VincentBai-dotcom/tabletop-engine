import { AppError, toErrorResponse } from "../errors";
import type { RoomService } from "../room";
import type {
  LiveClientMessage,
  LiveConnection,
  LiveConnectionRegistry,
  LiveServerMessage,
} from "./model";

export interface LiveMessageHandler {
  handleMessage(
    connection: LiveConnection,
    message: LiveClientMessage,
  ): Promise<void>;
}

export interface LiveMessageHandlerDeps {
  registry: LiveConnectionRegistry;
  roomService: RoomService;
}

function sendError(connection: LiveConnection, error: unknown) {
  const response = toErrorResponse(error);
  connection.send({
    type: "error",
    code: response.body.error.code,
    message: response.body.error.message,
  } satisfies LiveServerMessage);
}

export function createLiveMessageHandler({
  registry,
  roomService,
}: LiveMessageHandlerDeps): LiveMessageHandler {
  function requirePlayerSessionId(connection: LiveConnection) {
    const playerSessionId = registry.getPlayerSessionIdByConnectionId(
      connection.id,
    );
    if (!playerSessionId) {
      throw new AppError(
        "live_connection_not_registered",
        401,
        "Live connection is not registered",
      );
    }
    return playerSessionId;
  }

  return {
    async handleMessage(connection, message) {
      try {
        const playerSessionId = requirePlayerSessionId(connection);

        switch (message.type) {
          case "subscribe_room":
            registry.subscribeToRoom(playerSessionId, message.roomId);
            return;

          case "room_set_ready":
            await roomService.setReady({
              playerSessionId,
              roomId: message.roomId,
              ready: message.ready,
            });
            return;

          case "room_leave":
            await roomService.leaveRoom({
              playerSessionId,
              roomId: message.roomId,
            });
            return;

          case "room_start_game":
            await roomService.startGame({
              playerSessionId,
              roomId: message.roomId,
            });
            return;

          case "subscribe_game":
            registry.subscribeToGame(playerSessionId, message.gameSessionId);
            return;

          case "game_command":
            throw new AppError(
              "game_commands_not_implemented",
              501,
              "Game commands are not implemented yet",
            );
        }
      } catch (error) {
        sendError(connection, error);
      }
    },
  };
}
