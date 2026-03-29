import type { GameDefinition } from "../game-definition";
import type { ObjectFieldType } from "../schema";
import type { CommandDefinition } from "../types/command";

export interface ProtocolCommandDescriptor {
  commandId: string;
  payloadSchema: ObjectFieldType;
}

export interface GameProtocolDescriptor {
  name: string;
  commands: Record<string, ProtocolCommandDescriptor>;
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
    if (typeof state.type.prototype.projectCustomView === "function") {
      throw new Error(
        `custom_view_schema_required:${state.type.name || "anonymous"}`,
      );
    }
  }

  return {
    name: game.name,
    commands,
  };
}
