import type { Command, CommandDefinition } from "./types/command";
import type { ProgressionDefinition } from "./types/progression";
import type { RuntimeState } from "./types/state";
import type { RNGApi } from "./types/rng";

type AnyCommandDefinition<GameState extends object> = CommandDefinition<
  GameState,
  RuntimeState,
  Command
>;

export interface GameSetupContext<GameState extends object = object> {
  game: GameState;
  runtime: RuntimeState;
  rng: RNGApi;
  playerIds: readonly string[];
}

export interface GameDefinition<
  GameState extends object = object,
  Commands extends Record<string, AnyCommandDefinition<GameState>> = Record<
    string,
    AnyCommandDefinition<GameState>
  >,
> {
  name: string;
  initialState: () => GameState;
  commands: Commands;
  progression?: ProgressionDefinition;
  rngSeed?: string | number;
  setup?: (context: GameSetupContext<GameState>) => void;
}

export interface GameDefinitionInput<
  GameState extends object = object,
  Commands extends Record<string, AnyCommandDefinition<GameState>> = Record<
    string,
    AnyCommandDefinition<GameState>
  >,
> extends Omit<GameDefinition<GameState, Commands>, "name"> {
  name: string;
}

interface GameDefinitionBuilderState<
  GameState extends object = object,
  Commands extends Record<string, AnyCommandDefinition<GameState>> = Record<
    string,
    AnyCommandDefinition<GameState>
  >,
> extends Partial<GameDefinition<GameState, Commands>> {
  name: string;
}

export class GameDefinitionBuilder<
  GameState extends object = object,
  Commands extends Record<string, AnyCommandDefinition<GameState>> = Record<
    string,
    AnyCommandDefinition<GameState>
  >,
> {
  private readonly config: GameDefinitionBuilderState<GameState, Commands>;

  constructor(name: string) {
    this.config = {
      name,
    };
  }

  initialState<NextGameState extends object>(
    initialState: () => NextGameState,
  ): GameDefinitionBuilder<
    NextGameState,
    Record<string, AnyCommandDefinition<NextGameState>>
  > {
    (
      this.config as unknown as GameDefinitionBuilderState<
        NextGameState,
        Record<string, AnyCommandDefinition<NextGameState>>
      >
    ).initialState = initialState;

    return this as unknown as GameDefinitionBuilder<
      NextGameState,
      Record<string, AnyCommandDefinition<NextGameState>>
    >;
  }

  commands<
    NextCommands extends Record<string, AnyCommandDefinition<GameState>>,
  >(commands: NextCommands): GameDefinitionBuilder<GameState, NextCommands> {
    (
      this.config as unknown as GameDefinitionBuilderState<
        GameState,
        NextCommands
      >
    ).commands = commands;

    return this as unknown as GameDefinitionBuilder<GameState, NextCommands>;
  }

  progression(progression: ProgressionDefinition): this {
    this.config.progression = progression;
    return this;
  }

  rngSeed(rngSeed: string | number | undefined): this {
    this.config.rngSeed = rngSeed;
    return this;
  }

  setup(setup: (context: GameSetupContext<GameState>) => void): this {
    this.config.setup = setup;
    return this;
  }

  build(): GameDefinition<GameState, Commands> {
    if (!this.config.initialState) {
      throw new Error("initial_state_required");
    }

    if (!this.config.commands) {
      throw new Error("commands_required");
    }

    return {
      name: this.config.name,
      initialState: this.config.initialState,
      commands: this.config.commands,
      progression: this.config.progression,
      rngSeed: this.config.rngSeed,
      setup: this.config.setup,
    };
  }
}
