import { Type, type TSchema } from "@sinclair/typebox";
import type { GameDefinition } from "../game-definition";
import type { CommandDefinition } from "../types/command";
import { describeGameProtocol } from "./describe";

export interface EngineWebSocketMessageNames {
  listAvailableCommands: string;
  availableCommands: string;
  discover: string;
  discoveryResult: string;
  execute: string;
  executionResult: string;
  gameSnapshot: string;
  gameEnded: string;
  error: string;
}

export interface EngineWebSocketProtocolOptions {
  messages?: Partial<EngineWebSocketMessageNames>;
}

export interface EngineWebSocketProtocolDescriptor {
  messages: EngineWebSocketMessageNames;
  schemas: {
    visibleState: TSchema;
    commandPayload: TSchema;
    discoveryPayload: TSchema;
    discoveryResult: TSchema;
    gameEndedResult: TSchema;
    listAvailableCommandsRequest: TSchema;
    availableCommandsResponse: TSchema;
    discoverRequest: TSchema;
    discoveryResultMessage: TSchema;
    executeRequest: TSchema;
    executionResultMessage: TSchema;
    gameSnapshotMessage: TSchema;
    gameEndedMessage: TSchema;
    errorMessage: TSchema;
  };
}

const defaultMessageNames: EngineWebSocketMessageNames = {
  listAvailableCommands: "game_list_available_commands",
  availableCommands: "game_available_commands",
  discover: "game_discover",
  discoveryResult: "game_discovery_result",
  execute: "game_execute",
  executionResult: "game_execution_result",
  gameSnapshot: "game_snapshot",
  gameEnded: "game_ended",
  error: "error",
};

export function describeEngineWebSocketProtocol<
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
  options: EngineWebSocketProtocolOptions = {},
): EngineWebSocketProtocolDescriptor {
  const protocol = describeGameProtocol(game);
  const messages = {
    ...defaultMessageNames,
    ...options.messages,
  };
  const commandPayload = createHostedCommandPayloadSchema(protocol.commands);
  const discoveryPayload = createHostedDiscoveryPayloadSchema(
    protocol.commands,
  );
  const discoveryResult = createHostedDiscoveryResultSchema(protocol.commands);
  const visibleState = protocol.viewSchema;
  const gameEndedResult = Type.Object({
    reason: Type.Union([
      Type.Literal("completed"),
      Type.Literal("invalidated"),
    ]),
    winnerPlayerIds: Type.Optional(Type.Array(Type.String())),
    message: Type.Optional(Type.String()),
  });

  return {
    messages,
    schemas: {
      visibleState,
      commandPayload,
      discoveryPayload,
      discoveryResult,
      gameEndedResult,
      listAvailableCommandsRequest: Type.Object({
        type: Type.Literal(messages.listAvailableCommands),
        requestId: Type.String(),
        gameSessionId: Type.String(),
      }),
      availableCommandsResponse: Type.Object({
        type: Type.Literal(messages.availableCommands),
        requestId: Type.String(),
        gameSessionId: Type.String(),
        availableCommands: Type.Array(Type.String()),
      }),
      discoverRequest: Type.Object({
        type: Type.Literal(messages.discover),
        requestId: Type.String(),
        gameSessionId: Type.String(),
        discovery: discoveryPayload,
      }),
      discoveryResultMessage: Type.Object({
        type: Type.Literal(messages.discoveryResult),
        requestId: Type.String(),
        gameSessionId: Type.String(),
        result: Type.Union([discoveryResult, Type.Null()]),
      }),
      executeRequest: Type.Object({
        type: Type.Literal(messages.execute),
        requestId: Type.String(),
        gameSessionId: Type.String(),
        command: commandPayload,
      }),
      executionResultMessage: Type.Union([
        Type.Object({
          type: Type.Literal(messages.executionResult),
          requestId: Type.String(),
          gameSessionId: Type.String(),
          accepted: Type.Literal(true),
          stateVersion: Type.Number(),
          events: Type.Array(Type.Unknown()),
        }),
        Type.Object({
          type: Type.Literal(messages.executionResult),
          requestId: Type.String(),
          gameSessionId: Type.String(),
          accepted: Type.Literal(false),
          stateVersion: Type.Number(),
          reason: Type.String(),
          metadata: Type.Optional(Type.Unknown()),
          events: Type.Array(Type.Unknown()),
        }),
      ]),
      gameSnapshotMessage: Type.Object({
        type: Type.Literal(messages.gameSnapshot),
        gameSessionId: Type.String(),
        stateVersion: Type.Number(),
        view: visibleState,
        availableCommands: Type.Array(Type.String()),
        events: Type.Array(Type.Unknown()),
      }),
      gameEndedMessage: Type.Object({
        type: Type.Literal(messages.gameEnded),
        gameSessionId: Type.String(),
        result: gameEndedResult,
      }),
      errorMessage: Type.Object({
        type: Type.Literal(messages.error),
        requestId: Type.Optional(Type.String()),
        code: Type.String(),
        message: Type.Optional(Type.String()),
      }),
    },
  };
}

function createHostedCommandPayloadSchema(
  commands: Record<
    string,
    {
      commandSchema: { schema?: TSchema };
    }
  >,
): TSchema {
  const variants = Object.entries(commands).map(([commandId, command]) =>
    Type.Object({
      type: Type.Literal(commandId),
      input: command.commandSchema.schema!,
    }),
  );

  if (variants.length === 0) {
    return Type.Never();
  }

  return variants.length === 1 ? variants[0]! : Type.Union(variants);
}

function createHostedDiscoveryPayloadSchema(
  commands: Record<
    string,
    {
      discovery?: {
        steps: Array<{
          stepId: string;
          inputSchema: { schema?: TSchema };
        }>;
      };
    }
  >,
): TSchema {
  const variants = Object.entries(commands).flatMap(([commandId, command]) =>
    command.discovery
      ? command.discovery.steps.map((step) =>
          Type.Object({
            type: Type.Literal(commandId),
            step: Type.Literal(step.stepId),
            input: step.inputSchema.schema!,
          }),
        )
      : [],
  );

  if (variants.length === 0) {
    return Type.Never();
  }

  return variants.length === 1 ? variants[0]! : Type.Union(variants);
}

function createHostedDiscoveryResultSchema(
  commands: Record<
    string,
    {
      commandSchema: { schema?: TSchema };
      discovery?: {
        steps: Array<{
          stepId: string;
          inputSchema: { schema?: TSchema };
          outputSchema: { schema?: TSchema };
        }>;
      };
    }
  >,
): TSchema {
  const variants = Object.entries(commands).flatMap(([commandId, command]) => {
    if (!command.discovery) {
      return [];
    }

    const complete = Type.Object({
      type: Type.Literal(commandId),
      result: Type.Object({
        complete: Type.Literal(true),
        input: command.commandSchema.schema!,
      }),
    });

    const steps = command.discovery.steps.map((step) =>
      Type.Object({
        type: Type.Literal(commandId),
        result: Type.Object({
          complete: Type.Literal(false),
          step: Type.Literal(step.stepId),
          options: Type.Array(
            createDiscoveryOptionSchema(
              step.outputSchema.schema!,
              command.discovery!.steps.map((targetStep) => ({
                stepId: targetStep.stepId,
                inputSchema: targetStep.inputSchema.schema!,
              })),
            ),
          ),
        }),
      }),
    );

    return [...steps, complete];
  });

  if (variants.length === 0) {
    return Type.Never();
  }

  return variants.length === 1 ? variants[0]! : Type.Union(variants);
}

function createDiscoveryOptionSchema(
  outputSchema: TSchema,
  nextTargets: Array<{ stepId: string; inputSchema: TSchema }>,
): TSchema {
  const variants = nextTargets.map((targetStep) =>
    Type.Object({
      id: Type.String(),
      output: outputSchema,
      nextStep: Type.Literal(targetStep.stepId),
      nextInput: targetStep.inputSchema,
    }),
  );

  return variants.length === 1 ? variants[0]! : Type.Union(variants);
}
