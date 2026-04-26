import type { TSchema } from "@sinclair/typebox";
import type { GameDefinition } from "../game-definition";
import type { CommandDefinition } from "../types/command";
import { describeGameProtocol } from "./describe";
import {
  describeEngineWebSocketProtocol,
  type EngineWebSocketMessageNames,
} from "./engine-websocket";

export type AsyncApiChannelNames = EngineWebSocketMessageNames;

export interface AsyncApiOptions {
  title?: string;
  version?: string;
  channels?: Partial<AsyncApiChannelNames>;
}

export interface AsyncApiDocument {
  asyncapi: "2.6.0";
  info: {
    title: string;
    version: string;
  };
  channels: Record<
    string,
    {
      publish?: {
        message: {
          $ref: string;
        };
      };
      subscribe?: {
        message: {
          $ref: string;
        };
      };
    }
  >;
  components: {
    messages: Record<
      string,
      {
        name: string;
        payload: TSchema;
      }
    >;
    schemas: Record<string, TSchema>;
  };
}

export function generateAsyncApi<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Commands extends Record<string, CommandDefinition<FacadeGameState>>,
  SetupInput extends object | undefined = undefined,
>(
  game: GameDefinition<
    CanonicalGameState,
    FacadeGameState,
    Commands,
    SetupInput
  >,
  options: AsyncApiOptions = {},
): AsyncApiDocument {
  const protocol = describeGameProtocol(game);
  const websocket = describeEngineWebSocketProtocol(game, {
    messages: options.channels,
  });
  const channels = websocket.messages;

  return {
    asyncapi: "2.6.0",
    info: {
      title: options.title ?? protocol.name,
      version: options.version ?? "1.0.0",
    },
    channels: {
      [channels.listAvailableCommands]: {
        subscribe: {
          message: {
            $ref: "#/components/messages/GameListAvailableCommands",
          },
        },
      },
      [channels.availableCommands]: {
        publish: {
          message: {
            $ref: "#/components/messages/GameAvailableCommands",
          },
        },
      },
      [channels.discover]: {
        subscribe: {
          message: {
            $ref: "#/components/messages/GameDiscover",
          },
        },
      },
      [channels.discoveryResult]: {
        publish: {
          message: {
            $ref: "#/components/messages/GameDiscoveryResult",
          },
        },
      },
      [channels.execute]: {
        subscribe: {
          message: {
            $ref: "#/components/messages/GameExecute",
          },
        },
      },
      [channels.executionResult]: {
        publish: {
          message: {
            $ref: "#/components/messages/GameExecutionResult",
          },
        },
      },
      [channels.gameSnapshot]: {
        publish: {
          message: {
            $ref: "#/components/messages/GameSnapshot",
          },
        },
      },
      [channels.gameEnded]: {
        publish: {
          message: {
            $ref: "#/components/messages/GameEnded",
          },
        },
      },
      [channels.error]: {
        publish: {
          message: {
            $ref: "#/components/messages/GameError",
          },
        },
      },
    },
    components: {
      messages: {
        GameListAvailableCommands: {
          name: "GameListAvailableCommands",
          payload: websocket.schemas.listAvailableCommandsRequest,
        },
        GameAvailableCommands: {
          name: "GameAvailableCommands",
          payload: websocket.schemas.availableCommandsResponse,
        },
        GameDiscover: {
          name: "GameDiscover",
          payload: websocket.schemas.discoverRequest,
        },
        GameDiscoveryResult: {
          name: "GameDiscoveryResult",
          payload: websocket.schemas.discoveryResultMessage,
        },
        GameExecute: {
          name: "GameExecute",
          payload: websocket.schemas.executeRequest,
        },
        GameExecutionResult: {
          name: "GameExecutionResult",
          payload: websocket.schemas.executionResultMessage,
        },
        GameSnapshot: {
          name: "GameSnapshot",
          payload: websocket.schemas.gameSnapshotMessage,
        },
        GameEnded: {
          name: "GameEnded",
          payload: websocket.schemas.gameEndedMessage,
        },
        GameError: {
          name: "GameError",
          payload: websocket.schemas.errorMessage,
        },
      },
      schemas: {
        VisibleState: websocket.schemas.visibleState,
        CommandPayload: websocket.schemas.commandPayload,
        DiscoveryPayload: websocket.schemas.discoveryPayload,
        DiscoveryResult: websocket.schemas.discoveryResult,
        GameEndedResult: websocket.schemas.gameEndedResult,
        GameListAvailableCommands:
          websocket.schemas.listAvailableCommandsRequest,
        GameAvailableCommands: websocket.schemas.availableCommandsResponse,
        GameDiscover: websocket.schemas.discoverRequest,
        GameDiscoveryResult: websocket.schemas.discoveryResultMessage,
        GameExecute: websocket.schemas.executeRequest,
        GameExecutionResult: websocket.schemas.executionResultMessage,
        GameSnapshot: websocket.schemas.gameSnapshotMessage,
        GameEnded: websocket.schemas.gameEndedMessage,
        GameError: websocket.schemas.errorMessage,
      },
    },
  };
}
