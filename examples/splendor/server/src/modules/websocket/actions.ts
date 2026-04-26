import { AppError, toErrorResponse } from "../errors";
import type { GameSessionService } from "../game-session";
import type { LivePresenceService } from "../live-presence";
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
  gameSessionService?: GameSessionService;
  livePresenceService?: LivePresenceService;
}

function sendError(
  connection: LiveConnection,
  error: unknown,
  requestId?: string,
) {
  const response = toErrorResponse(error);
  connection.send({
    type: "error",
    ...(requestId ? { requestId } : {}),
    code: response.body.error.code,
    message: response.body.error.message,
  } satisfies LiveServerMessage);
}

export function createLiveMessageHandler({
  registry,
  roomService,
  gameSessionService,
  livePresenceService,
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
            if (livePresenceService) {
              connection.send(
                await livePresenceService.handleRoomSubscribed({
                  playerSessionId,
                  roomId: message.roomId,
                }),
              );
            }
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
            if (livePresenceService) {
              connection.send(
                await livePresenceService.handleGameSubscribed({
                  playerSessionId,
                  gameSessionId: message.gameSessionId,
                }),
              );
            }
            return;

          case "game_list_available_commands": {
            if (!gameSessionService) {
              throw new AppError(
                "game_commands_not_implemented",
                501,
                "Game commands are not implemented yet",
              );
            }

            const snapshot = await gameSessionService.getPlayerSnapshot({
              gameSessionId: message.gameSessionId,
              playerSessionId,
            });

            connection.send({
              type: "game_available_commands",
              requestId: message.requestId,
              gameSessionId: message.gameSessionId,
              availableCommands: snapshot.availableCommands,
            });
            return;
          }

          case "game_discover": {
            if (!gameSessionService) {
              throw new AppError(
                "game_commands_not_implemented",
                501,
                "Game commands are not implemented yet",
              );
            }

            const discoveryResult = await gameSessionService.discoverCommand({
              gameSessionId: message.gameSessionId,
              playerSessionId,
              discovery: message.discovery,
            });
            const discoveryType =
              typeof message.discovery === "object" &&
              message.discovery !== null &&
              "type" in message.discovery &&
              typeof message.discovery.type === "string"
                ? message.discovery.type
                : "unknown_discovery";

            connection.send({
              type: "game_discovery_result",
              requestId: message.requestId,
              gameSessionId: message.gameSessionId,
              result: discoveryResult
                ? {
                    type: discoveryType,
                    result: discoveryResult,
                  }
                : null,
            });
            return;
          }

          case "game_execute": {
            if (!gameSessionService) {
              throw new AppError(
                "game_commands_not_implemented",
                501,
                "Game commands are not implemented yet",
              );
            }

            const result = await gameSessionService.submitCommand({
              gameSessionId: message.gameSessionId,
              playerSessionId,
              command: message.command,
            });

            connection.send({
              type: "game_execution_result",
              requestId: message.requestId,
              gameSessionId: message.gameSessionId,
              accepted: result.accepted,
              stateVersion: result.stateVersion,
              events: result.events,
              ...(result.accepted === false
                ? {
                    reason: result.reason,
                    metadata: result.metadata,
                  }
                : {}),
            });

            if (result.accepted === false) {
              return;
            }

            for (const playerView of result.playerViews) {
              const gameConnection = registry.getGameConnectionForPlayer(
                playerView.playerSessionId,
                message.gameSessionId,
              );
              gameConnection?.send({
                type: "game_snapshot",
                gameSessionId: message.gameSessionId,
                stateVersion: result.stateVersion,
                events: result.events,
                view: playerView.view,
                availableCommands: playerView.availableCommands,
              });
            }
            return;
          }
        }
      } catch (error) {
        sendError(
          connection,
          error,
          "requestId" in message && typeof message.requestId === "string"
            ? message.requestId
            : undefined,
        );
      }
    },
  };
}
