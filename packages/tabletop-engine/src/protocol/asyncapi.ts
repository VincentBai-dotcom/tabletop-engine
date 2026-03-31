import { Type, type TSchema } from "@sinclair/typebox";
import type { GameDefinition } from "../game-definition";
import type { CommandDefinition } from "../types/command";
import { describeGameProtocol } from "./describe";

export interface AsyncApiChannelNames {
  submitCommand: string;
  matchView: string;
  commandRejected: string;
}

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

const defaultChannels: AsyncApiChannelNames = {
  submitCommand: "command.submit",
  matchView: "match.view",
  commandRejected: "command.rejected",
};

export function generateAsyncApi<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Commands extends Record<
    string,
    CommandDefinition<FacadeGameState, Record<string, unknown>>
  >,
>(
  game: GameDefinition<CanonicalGameState, FacadeGameState, Commands>,
  options: AsyncApiOptions = {},
): AsyncApiDocument {
  const protocol = describeGameProtocol(game);
  const channels = {
    ...defaultChannels,
    ...options.channels,
  };
  const commandInputSchemas = Object.fromEntries(
    Object.entries(protocol.commands).map(([commandId, command]) => [
      commandId,
      createCommandInputSchema(commandId, command.payloadSchema.schema!),
    ]),
  );
  const commandInputSchemaList = Object.values(commandInputSchemas);
  const commandInputSchema =
    commandInputSchemaList.length === 0
      ? Type.Never()
      : commandInputSchemaList.length === 1
        ? commandInputSchemaList[0]!
        : Type.Union(commandInputSchemaList);
  const visibleStateSchema = protocol.viewSchema;
  const matchViewSchema = Type.Object({
    type: Type.Literal("match.view"),
    view: visibleStateSchema,
  });
  const commandRejectedSchema = Type.Object({
    type: Type.Literal("command.rejected"),
    reason: Type.String(),
  });

  return {
    asyncapi: "2.6.0",
    info: {
      title: options.title ?? protocol.name,
      version: options.version ?? "1.0.0",
    },
    channels: {
      [channels.submitCommand]: {
        subscribe: {
          message: {
            $ref: "#/components/messages/SubmitCommand",
          },
        },
      },
      [channels.matchView]: {
        publish: {
          message: {
            $ref: "#/components/messages/MatchView",
          },
        },
      },
      [channels.commandRejected]: {
        publish: {
          message: {
            $ref: "#/components/messages/CommandRejected",
          },
        },
      },
    },
    components: {
      messages: {
        SubmitCommand: {
          name: "SubmitCommand",
          payload: commandInputSchema,
        },
        MatchView: {
          name: "MatchView",
          payload: matchViewSchema,
        },
        CommandRejected: {
          name: "CommandRejected",
          payload: commandRejectedSchema,
        },
      },
      schemas: {
        VisibleState: visibleStateSchema,
        MatchView: matchViewSchema,
        CommandRejected: commandRejectedSchema,
        ...Object.fromEntries(
          Object.entries(commandInputSchemas).map(([commandId, schema]) => [
            `${toPascalCase(commandId)}CommandInput`,
            schema,
          ]),
        ),
      },
    },
  };
}

function createCommandInputSchema(commandId: string, payloadSchema: TSchema) {
  return Type.Object({
    type: Type.Literal(commandId),
    actorId: Type.Optional(Type.String()),
    payload: payloadSchema,
  });
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join("");
}
