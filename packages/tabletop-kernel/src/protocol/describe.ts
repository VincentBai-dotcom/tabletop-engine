import type { GameDefinition } from "../game-definition";
import type { ObjectFieldType, SerializableSchema } from "../schema";
import type { CommandDefinition } from "../types/command";

export interface ProtocolCommandDescriptor {
  commandId: string;
  payloadSchema: ObjectFieldType;
}

export interface GameProtocolDescriptor {
  name: string;
  commands: Record<string, ProtocolCommandDescriptor>;
  customViews: Record<string, SerializableSchema>;
}

export function describeGameProtocol<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Commands extends Record<
    string,
    CommandDefinition<FacadeGameState, ObjectFieldType>
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
  };
}
