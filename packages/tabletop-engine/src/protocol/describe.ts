import { Type, type TSchema } from "@sinclair/typebox";
import type { GameDefinition } from "../game-definition";
import type { FieldType, SerializableSchema } from "../schema";
import type { CommandDefinition } from "../types/command";
import type { VisibilityMode } from "../state-facade/metadata";
import type { CompiledStateFacadeDefinition } from "../state-facade/compile";

export interface ProtocolCommandDescriptor {
  commandId: string;
  payloadSchema: {
    readonly static: Record<string, unknown>;
    readonly schema?: TSchema;
  };
}

export interface GameProtocolDescriptor {
  name: string;
  commands: Record<string, ProtocolCommandDescriptor>;
  customViews: Record<string, SerializableSchema>;
  viewSchema: TSchema;
}

export function describeGameProtocol<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Commands extends Record<
    string,
    CommandDefinition<FacadeGameState, Record<string, unknown>>
  >,
>(
  game: GameDefinition<CanonicalGameState, FacadeGameState, Commands>,
): GameProtocolDescriptor {
  const commands: Record<string, ProtocolCommandDescriptor> = {};
  const customViews: Record<string, SerializableSchema> = {};

  for (const [commandId, command] of Object.entries(game.commands)) {
    if (!command.payloadSchema) {
      throw new Error(`command_payload_schema_required:${commandId}`);
    }

    commands[commandId] = {
      commandId,
      payloadSchema: command.payloadSchema,
    };
  }

  for (const state of Object.values(game.stateFacade?.states ?? {})) {
    const hasCustomViewMethod =
      typeof state.type.prototype.projectCustomView === "function";

    if (state.customViewSchema && !hasCustomViewMethod) {
      throw new Error(
        `custom_view_schema_requires_project_custom_view:${
          state.type.name || "anonymous"
        }`,
      );
    }

    if (hasCustomViewMethod && !state.customViewSchema) {
      throw new Error(
        `custom_view_schema_required:${state.type.name || "anonymous"}`,
      );
    }

    if (state.customViewSchema) {
      customViews[state.type.name || "anonymous"] = state.customViewSchema;
    }
  }

  return {
    name: game.name,
    commands,
    customViews,
    viewSchema: createVisibleStateSchema(game.stateFacade),
  };
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

  if (state.customViewSchema) {
    return toTypeBoxSchema(state.customViewSchema);
  }

  return Type.Object(
    Object.fromEntries(
      Object.entries(state.fields).map(([fieldName, fieldType]) => {
        const visibility = state.fieldVisibility[fieldName]?.mode;

        return [
          fieldName,
          inferFieldViewSchema(compiled, fieldType, visibility),
        ];
      }),
    ),
  );
}

function inferFieldViewSchema(
  compiled: CompiledStateFacadeDefinition,
  fieldType: FieldType,
  visibility?: VisibilityMode,
): TSchema {
  const visibleSchema = inferVisibleFieldSchema(compiled, fieldType);

  if (visibility === "hidden") {
    return hiddenEnvelopeSchema;
  }

  if (visibility === "visible_to_self") {
    return Type.Union([visibleSchema, hiddenEnvelopeSchema]);
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
