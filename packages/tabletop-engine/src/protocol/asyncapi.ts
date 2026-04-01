import { Type, type TSchema } from "@sinclair/typebox";
import type { GameDefinition } from "../game-definition";
import type { CommandDefinitionLike } from "../types/command";
import { describeGameProtocol } from "./describe";

export interface AsyncApiChannelNames {
  submitCommand: string;
  discoverCommand: string;
  discoveryResult: string;
  discoveryRejected: string;
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
  discoverCommand: "command.discover",
  discoveryResult: "command.discovered",
  discoveryRejected: "command.discovery_rejected",
  matchView: "match.view",
  commandRejected: "command.rejected",
};

export function generateAsyncApi<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Commands extends Record<string, CommandDefinitionLike<FacadeGameState>>,
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
  const discoveryInputSchemas = Object.fromEntries(
    Object.entries(protocol.commands)
      .filter(([, command]) => command.discoveryDraftSchema?.schema)
      .map(([commandId, command]) => [
        commandId,
        createDiscoveryInputSchema(
          commandId,
          command.discoveryDraftSchema!.schema!,
        ),
      ]),
  );
  const discoveryResultSchemas = Object.fromEntries(
    Object.entries(protocol.commands)
      .filter(([, command]) => command.discoveryDraftSchema?.schema)
      .map(([commandId, command]) => [
        commandId,
        createDiscoveryEnvelopeSchema(
          commandId,
          command.discoveryDraftSchema!.schema!,
          command.payloadSchema.schema!,
        ),
      ]),
  );
  const discoveryRejectedSchemas = Object.fromEntries(
    Object.entries(protocol.commands)
      .filter(([, command]) => command.discoveryDraftSchema?.schema)
      .map(([commandId]) => [
        commandId,
        createDiscoveryRejectedSchema(commandId),
      ]),
  );
  const commandInputSchemaList = Object.values(commandInputSchemas);
  const commandInputSchema =
    commandInputSchemaList.length === 0
      ? Type.Never()
      : commandInputSchemaList.length === 1
        ? commandInputSchemaList[0]!
        : Type.Union(commandInputSchemaList);
  const discoveryInputSchemaList = Object.values(discoveryInputSchemas);
  const discoveryInputSchema =
    discoveryInputSchemaList.length === 0
      ? Type.Never()
      : discoveryInputSchemaList.length === 1
        ? discoveryInputSchemaList[0]!
        : Type.Union(discoveryInputSchemaList);
  const discoveryResultSchemaList = Object.values(discoveryResultSchemas);
  const discoveryResultSchema =
    discoveryResultSchemaList.length === 0
      ? Type.Never()
      : discoveryResultSchemaList.length === 1
        ? discoveryResultSchemaList[0]!
        : Type.Union(discoveryResultSchemaList);
  const discoveryRejectedSchemaList = Object.values(discoveryRejectedSchemas);
  const discoveryRejectedSchema =
    discoveryRejectedSchemaList.length === 0
      ? Type.Never()
      : discoveryRejectedSchemaList.length === 1
        ? discoveryRejectedSchemaList[0]!
        : Type.Union(discoveryRejectedSchemaList);
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
      [channels.discoverCommand]: {
        subscribe: {
          message: {
            $ref: "#/components/messages/DiscoverCommand",
          },
        },
      },
      [channels.discoveryResult]: {
        publish: {
          message: {
            $ref: "#/components/messages/DiscoveryResult",
          },
        },
      },
      [channels.discoveryRejected]: {
        publish: {
          message: {
            $ref: "#/components/messages/DiscoveryRejected",
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
        DiscoverCommand: {
          name: "DiscoverCommand",
          payload: discoveryInputSchema,
        },
        DiscoveryResult: {
          name: "DiscoveryResult",
          payload: discoveryResultSchema,
        },
        DiscoveryRejected: {
          name: "DiscoveryRejected",
          payload: discoveryRejectedSchema,
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
        DiscoveryResult: discoveryResultSchema,
        DiscoveryRejected: discoveryRejectedSchema,
        MatchView: matchViewSchema,
        CommandRejected: commandRejectedSchema,
        ...Object.fromEntries(
          Object.entries(commandInputSchemas).map(([commandId, schema]) => [
            `${toPascalCase(commandId)}CommandInput`,
            schema,
          ]),
        ),
        ...Object.fromEntries(
          Object.entries(discoveryInputSchemas).map(([commandId, schema]) => [
            `${toPascalCase(commandId)}DiscoveryInput`,
            schema,
          ]),
        ),
        ...Object.fromEntries(
          Object.entries(discoveryResultSchemas).map(([commandId, schema]) => [
            `${toPascalCase(commandId)}DiscoveryResult`,
            schema,
          ]),
        ),
        ...Object.fromEntries(
          Object.entries(discoveryRejectedSchemas).map(
            ([commandId, schema]) => [
              `${toPascalCase(commandId)}DiscoveryRejected`,
              schema,
            ],
          ),
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

function createDiscoveryInputSchema(commandId: string, draftSchema: TSchema) {
  return Type.Object({
    type: Type.Literal(commandId),
    actorId: Type.Optional(Type.String()),
    requestId: Type.Optional(Type.String()),
    draft: Type.Optional(draftSchema),
  });
}

function createRawDiscoveryResultSchema(
  draftSchema: TSchema,
  payloadSchema: TSchema,
) {
  return Type.Union([
    Type.Object({
      complete: Type.Literal(false),
      step: Type.String(),
      options: Type.Array(
        Type.Object({
          id: Type.String(),
          nextDraft: draftSchema,
          metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        }),
      ),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    }),
    Type.Object({
      complete: Type.Literal(true),
      payload: payloadSchema,
      metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    }),
  ]);
}

function createDiscoveryEnvelopeSchema(
  commandId: string,
  draftSchema: TSchema,
  payloadSchema: TSchema,
) {
  return Type.Object({
    type: Type.Literal(commandId),
    actorId: Type.Optional(Type.String()),
    requestId: Type.Optional(Type.String()),
    result: createRawDiscoveryResultSchema(draftSchema, payloadSchema),
  });
}

function createDiscoveryRejectedSchema(commandId: string) {
  return Type.Object({
    type: Type.Literal(commandId),
    actorId: Type.Optional(Type.String()),
    requestId: Type.Optional(Type.String()),
    reason: Type.String(),
  });
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join("");
}
