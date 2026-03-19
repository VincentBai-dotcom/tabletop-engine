import type { Command, CommandDefinition } from "./types/command";
import type { ProgressionDefinition } from "./types/progression";

export interface GameDefinition<
  GameState = Record<string, unknown>,
  RuntimeState = unknown,
  Commands extends Record<string, CommandDefinition<GameState, any, any>> = Record<
    string,
    CommandDefinition<GameState, any, any>
  >,
> {
  name: string;
  initialState: () => GameState;
  commands: Commands;
  progression?: ProgressionDefinition;
  rngSeed?: string | number;
  runtime?: RuntimeState;
}

export interface GameDefinitionInput<
  GameState = Record<string, unknown>,
  RuntimeState = unknown,
  Commands extends Record<string, CommandDefinition<GameState, any, any>> = Record<
    string,
    CommandDefinition<GameState, any, any>
  >,
> extends Omit<GameDefinition<GameState, RuntimeState, Commands>, "name"> {
  name: string;
}

export function defineGame<
  GameState = Record<string, unknown>,
  RuntimeState = unknown,
  Commands extends Record<string, CommandDefinition<GameState, any, any>> = Record<
    string,
    CommandDefinition<GameState, any, any>
  >,
>(config: GameDefinitionInput<GameState, RuntimeState, Commands>): GameDefinition<GameState, RuntimeState, Commands> {
  return config;
}
