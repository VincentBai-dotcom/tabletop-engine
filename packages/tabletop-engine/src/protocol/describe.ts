import { Type, type TSchema } from "@sinclair/typebox";
import type { GameDefinition } from "../game-definition";
import type { FieldType, SerializableSchema } from "../schema";
import type { CommandDefinition, CommandSchema } from "../types/command";
import type {
  FieldVisibilityConfig,
  VisibilityMode,
} from "../state-facade/metadata";
import type { CompiledStateFacadeDefinition } from "../state-facade/compile";

export interface ProtocolDiscoveryStepDescriptor {
  stepId: string;
  inputSchema: CommandSchema<Record<string, unknown>>;
  outputSchema: CommandSchema<Record<string, unknown>>;
}

export interface ProtocolDiscoveryDescriptor {
  startStep: string;
  steps: ProtocolDiscoveryStepDescriptor[];
}

export interface ProtocolCommandDescriptor {
  commandId: string;
  commandSchema: CommandSchema<Record<string, unknown>>;
  discovery?: ProtocolDiscoveryDescriptor;
}

export interface GameProtocolDescriptor {
  name: string;
  commands: Record<string, ProtocolCommandDescriptor>;
  viewSchema: TSchema;
}

export function describeGameProtocol<
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
): GameProtocolDescriptor {
  const commands: Record<string, ProtocolCommandDescriptor> = {};

  for (const [commandId, command] of Object.entries(game.commands)) {
    if (!command.commandSchema) {
      throw new Error(`command_payload_schema_required:${commandId}`);
    }

    const discovery = command.discovery
      ? normalizeDiscoveryDescriptor(commandId, command.discovery)
      : undefined;

    commands[commandId] = {
      commandId,
      commandSchema: command.commandSchema,
      discovery,
    };
  }

  return {
    name: game.name,
    commands,
    viewSchema: createVisibleStateSchema(game.stateFacade),
  };
}

function normalizeDiscoveryDescriptor(
  commandId: string,
  discovery: ProtocolDiscoveryDescriptor,
): ProtocolDiscoveryDescriptor {
  if (!Array.isArray(discovery.steps) || discovery.steps.length === 0) {
    throw new Error(`command_discovery_steps_required:${commandId}`);
  }

  const normalizedSteps: ProtocolDiscoveryStepDescriptor[] = [];
  const knownStepIds = new Set<string>();

  for (const [index, step] of discovery.steps.entries()) {
    if (!isObjectRecord(step)) {
      throw new Error(`command_discovery_step_invalid:${commandId}:${index}`);
    }

    if (typeof step.stepId !== "string" || step.stepId.length === 0) {
      throw new Error(
        `command_discovery_step_missing_step_id:${commandId}:${index}`,
      );
    }

    if (knownStepIds.has(step.stepId)) {
      throw new Error(
        `command_discovery_duplicate_step_id:${commandId}:${step.stepId}`,
      );
    }
    knownStepIds.add(step.stepId);

    if (!isObjectRecord(step.inputSchema)) {
      throw new Error(
        `command_discovery_step_missing_input_schema:${commandId}:${index}`,
      );
    }

    if (!isObjectRecord(step.outputSchema)) {
      throw new Error(
        `command_discovery_step_missing_output_schema:${commandId}:${index}`,
      );
    }

    if (typeof (step as { resolve?: unknown }).resolve !== "function") {
      throw new Error(
        `command_discovery_step_missing_resolve:${commandId}:${index}`,
      );
    }

    normalizedSteps.push({
      stepId: step.stepId,
      inputSchema: step.inputSchema,
      outputSchema: step.outputSchema,
    });
  }

  if (
    typeof discovery.startStep !== "string" ||
    discovery.startStep.length === 0 ||
    !knownStepIds.has(discovery.startStep)
  ) {
    throw new Error(`command_discovery_unknown_start_step:${commandId}`);
  }

  return {
    startStep: discovery.startStep,
    steps: normalizedSteps,
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createVisibleStateSchema(
  compiled?: CompiledStateFacadeDefinition,
): TSchema {
  return Type.Object({
    game: compiled
      ? inferStateViewSchema(compiled, compiled.root.name)
      : Type.Unknown(),
    progression: progressionStateSchema,
  });
}

function inferStateViewSchema(
  compiled: CompiledStateFacadeDefinition,
  stateName: string,
): TSchema {
  const state = compiled.states[stateName];

  if (!state) {
    throw new Error(`compiled_state_not_found:${stateName}`);
  }

  return Type.Object(
    Object.fromEntries(
      Object.entries(state.fields).map(([fieldName, fieldType]) => {
        const visibility = state.fieldVisibility[fieldName]?.mode;

        return [
          fieldName,
          inferFieldViewSchema(
            compiled,
            fieldType,
            state.fieldVisibility[fieldName],
            visibility,
          ),
        ];
      }),
    ),
  );
}

function inferFieldViewSchema(
  compiled: CompiledStateFacadeDefinition,
  fieldType: FieldType,
  fieldVisibility: FieldVisibilityConfig | undefined,
  visibility?: VisibilityMode,
): TSchema {
  const visibleSchema = inferVisibleFieldSchema(compiled, fieldType);
  const hiddenSchema = inferHiddenEnvelopeSchema(fieldVisibility?.schema);

  if (visibility === "hidden") {
    return hiddenSchema;
  }

  if (visibility === "visible_to_self") {
    return Type.Union([visibleSchema, hiddenSchema]);
  }

  return visibleSchema;
}

function inferVisibleFieldSchema(
  compiled: CompiledStateFacadeDefinition,
  fieldType: FieldType,
): TSchema {
  if (fieldType.kind === "state") {
    return inferStateViewSchema(compiled, fieldType.target().name);
  }

  if (fieldType.kind === "array") {
    return Type.Array(inferVisibleFieldSchema(compiled, fieldType.item));
  }

  if (fieldType.kind === "record") {
    return Type.Record(
      inferRecordKeySchema(fieldType.key),
      inferVisibleFieldSchema(compiled, fieldType.value),
    );
  }

  if (fieldType.kind === "object") {
    return Type.Object(
      Object.fromEntries(
        Object.entries(fieldType.properties).map(([key, nestedField]) => [
          key,
          inferVisibleFieldSchema(compiled, nestedField),
        ]),
      ),
    );
  }

  if (fieldType.kind === "optional") {
    return Type.Optional(inferVisibleFieldSchema(compiled, fieldType.item));
  }

  return toTypeBoxSchema(fieldType);
}

function inferRecordKeySchema(fieldType: FieldType): TSchema {
  if ("schema" in fieldType && fieldType.schema) {
    return fieldType.schema;
  }

  return Type.String();
}

function toTypeBoxSchema(schema: SerializableSchema | FieldType): TSchema {
  if ("schema" in schema && schema.schema) {
    return schema.schema;
  }

  return Type.Unknown();
}

function inferHiddenEnvelopeSchema(schema?: SerializableSchema): TSchema {
  if (!schema) {
    return hiddenEnvelopeSchema;
  }

  return Type.Object({
    __hidden: Type.Literal(true),
    value: toTypeBoxSchema(schema),
  });
}

const hiddenEnvelopeSchema = Type.Object({
  __hidden: Type.Literal(true),
});

const progressionSegmentSchema = Type.Object({
  id: Type.String(),
  kind: Type.Optional(Type.String()),
  parentId: Type.Optional(Type.String()),
  childIds: Type.Array(Type.String()),
  active: Type.Boolean(),
  ownerId: Type.Optional(Type.String()),
});

const progressionStateSchema = Type.Object({
  current: Type.Union([Type.String(), Type.Null()]),
  rootId: Type.Union([Type.String(), Type.Null()]),
  segments: Type.Record(Type.String(), progressionSegmentSchema),
});
