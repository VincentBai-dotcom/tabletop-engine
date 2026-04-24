import { Type, type TSchema } from "@sinclair/typebox";
import type { GameDefinition } from "../game-definition";
import type { CommandDefinition } from "../types/command";
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
  const channels = {
    ...defaultChannels,
    ...options.channels,
  };
  const commandSchemas = Object.fromEntries(
    Object.entries(protocol.commands).map(([commandId, command]) => [
      commandId,
      createCommandSchema(commandId, command.commandSchema.schema!),
    ]),
  );
  const discoveryCommandSchemas: TSchema[] = [];
  const discoveryResultSchemas: TSchema[] = [];
  const discoveryRejectedSchemas: TSchema[] = [];
  const schemaComponents: Record<string, TSchema> = {};

  for (const [commandId, command] of Object.entries(protocol.commands)) {
    if (!command.discovery) {
      continue;
    }

    const commandPascalCase = toPascalCase(commandId);
    const commandInputSchema = command.commandSchema.schema!;
    const stepRequestSchemas: TSchema[] = [];
    const stepResultSchemas: TSchema[] = [];

    for (const step of command.discovery.steps) {
      const stepPascalCase = toPascalCase(step.stepId);
      const inputSchema = step.inputSchema.schema!;
      const outputSchema = step.outputSchema.schema!;

      const discoveryInputSchema = createDiscoveryInputSchema(
        commandId,
        step.stepId,
        inputSchema,
      );
      const discoveryResultSchema = createDiscoveryStepResultSchema(
        step.stepId,
        outputSchema,
        command.discovery.steps.map((targetStep) => ({
          stepId: targetStep.stepId,
          inputSchema: targetStep.inputSchema.schema!,
        })),
      );

      schemaComponents[`${commandPascalCase}${stepPascalCase}DiscoveryInput`] =
        inputSchema;
      schemaComponents[`${commandPascalCase}${stepPascalCase}DiscoveryOutput`] =
        outputSchema;
      schemaComponents[
        `${commandPascalCase}${stepPascalCase}DiscoveryCommand`
      ] = discoveryInputSchema;
      schemaComponents[`${commandPascalCase}${stepPascalCase}DiscoveryResult`] =
        discoveryResultSchema;

      stepRequestSchemas.push(discoveryInputSchema);
      stepResultSchemas.push(discoveryResultSchema);
      discoveryCommandSchemas.push(discoveryInputSchema);
    }

    const commandDiscoveryResultSchema = createDiscoveryEnvelopeSchema(
      commandId,
      stepResultSchemas,
      commandInputSchema,
    );

    schemaComponents[`${commandPascalCase}DiscoverCommand`] =
      stepRequestSchemas.length === 1
        ? stepRequestSchemas[0]!
        : Type.Union(stepRequestSchemas);
    schemaComponents[`${commandPascalCase}DiscoveryResult`] =
      commandDiscoveryResultSchema;

    discoveryResultSchemas.push(commandDiscoveryResultSchema);
    discoveryRejectedSchemas.push(createDiscoveryRejectedSchema(commandId));
    schemaComponents[`${commandPascalCase}DiscoveryRejected`] =
      discoveryRejectedSchemas[discoveryRejectedSchemas.length - 1]!;
  }
  const commandSchemaList = Object.values(commandSchemas);
  const commandSchema =
    commandSchemaList.length === 0
      ? Type.Never()
      : commandSchemaList.length === 1
        ? commandSchemaList[0]!
        : Type.Union(commandSchemaList);
  const discoverySchemaList = discoveryCommandSchemas;
  const discoverySchema =
    discoverySchemaList.length === 0
      ? Type.Never()
      : discoverySchemaList.length === 1
        ? discoverySchemaList[0]!
        : Type.Union(discoverySchemaList);
  const discoveryResultSchemaList = discoveryResultSchemas;
  const discoveryResultSchema =
    discoveryResultSchemaList.length === 0
      ? Type.Never()
      : discoveryResultSchemaList.length === 1
        ? discoveryResultSchemaList[0]!
        : Type.Union(discoveryResultSchemaList);
  const discoveryRejectedSchemaList = discoveryRejectedSchemas;
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
          payload: commandSchema,
        },
        DiscoverCommand: {
          name: "DiscoverCommand",
          payload: discoverySchema,
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
          Object.entries(commandSchemas).map(([commandId, schema]) => [
            `${toPascalCase(commandId)}Command`,
            schema,
          ]),
        ),
        ...schemaComponents,
      },
    },
  };
}

function createCommandSchema(commandId: string, commandSchema: TSchema) {
  return Type.Object({
    type: Type.Literal(commandId),
    actorId: Type.String(),
    input: commandSchema,
  });
}

function createDiscoveryInputSchema(
  commandId: string,
  stepId: string,
  discoverySchema: TSchema,
) {
  return Type.Object({
    type: Type.Literal(commandId),
    actorId: Type.String(),
    requestId: Type.Optional(Type.String()),
    step: Type.Literal(stepId),
    input: discoverySchema,
  });
}

function createDiscoveryStepResultSchema(
  stepId: string,
  discoveryOutputSchema: TSchema,
  nextStepTargets: Array<{
    stepId: string;
    inputSchema: TSchema;
  }>,
) {
  const nextStepOptions = nextStepTargets.map((targetStep) =>
    Type.Object({
      id: Type.String(),
      output: discoveryOutputSchema,
      nextStep: Type.Literal(targetStep.stepId),
      nextInput: targetStep.inputSchema,
    }),
  );

  return Type.Object({
    complete: Type.Literal(false),
    step: Type.Literal(stepId),
    options: Type.Array(
      nextStepOptions.length === 1
        ? nextStepOptions[0]!
        : Type.Union(nextStepOptions),
    ),
  });
}

function createCommandDiscoveryResultSchema(
  resultSchemas: TSchema[],
  commandSchema: TSchema,
) {
  return Type.Union([
    ...resultSchemas,
    Type.Object({
      complete: Type.Literal(true),
      input: commandSchema,
    }),
  ]);
}

function createDiscoveryEnvelopeSchema(
  commandId: string,
  resultSchemas: TSchema[],
  commandSchema: TSchema,
) {
  return Type.Object({
    type: Type.Literal(commandId),
    actorId: Type.String(),
    requestId: Type.Optional(Type.String()),
    result: createCommandDiscoveryResultSchema(resultSchemas, commandSchema),
  });
}

function createDiscoveryRejectedSchema(commandId: string) {
  return Type.Object({
    type: Type.Literal(commandId),
    actorId: Type.String(),
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
