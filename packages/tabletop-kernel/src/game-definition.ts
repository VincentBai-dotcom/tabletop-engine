import type { Command, CommandDefinition } from "./types/command";
import type { ProgressionDefinition } from "./types/progression";
import type { RuntimeState } from "./types/state";
import type { RNGApi } from "./types/rng";

type AnyCommandDefinition<GameState extends object> = CommandDefinition<
  GameState,
  RuntimeState,
  Command
>;

type CommandDefinitionMap<GameState extends object> = Record<
  string,
  AnyCommandDefinition<GameState>
>;

type CommandDefinitionList<GameState extends object> =
  readonly AnyCommandDefinition<GameState>[];

export interface GameSetupContext<GameState extends object = object> {
  game: GameState;
  runtime: RuntimeState;
  rng: RNGApi;
  playerIds: readonly string[];
}

export interface GameDefinition<
  GameState extends object = object,
  Commands extends CommandDefinitionMap<GameState> =
    CommandDefinitionMap<GameState>,
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
  Commands extends CommandDefinitionMap<GameState> =
    CommandDefinitionMap<GameState>,
> extends Omit<GameDefinition<GameState, Commands>, "name"> {
  name: string;
}

interface GameDefinitionBuilderState<
  GameState extends object = object,
  Commands extends CommandDefinitionMap<GameState> =
    CommandDefinitionMap<GameState>,
> extends Partial<GameDefinition<GameState, Commands>> {
  name: string;
  commandList?: CommandDefinitionList<GameState>;
}

export class GameDefinitionBuilder<
  GameState extends object = object,
  Commands extends CommandDefinitionMap<GameState> =
    CommandDefinitionMap<GameState>,
> {
  private readonly config: GameDefinitionBuilderState<GameState, Commands>;

  constructor(name: string) {
    this.config = {
      name,
    };
  }

  initialState<NextGameState extends object>(
    initialState: () => NextGameState,
  ): GameDefinitionBuilder<NextGameState, CommandDefinitionMap<NextGameState>> {
    (
      this.config as unknown as GameDefinitionBuilderState<
        NextGameState,
        CommandDefinitionMap<NextGameState>
      >
    ).initialState = initialState;

    return this as unknown as GameDefinitionBuilder<
      NextGameState,
      CommandDefinitionMap<NextGameState>
    >;
  }

  commands<NextCommands extends CommandDefinitionMap<GameState>>(
    commands: NextCommands,
  ): GameDefinitionBuilder<GameState, NextCommands>;
  commands(
    commands: CommandDefinitionList<GameState>,
  ): GameDefinitionBuilder<GameState, CommandDefinitionMap<GameState>>;
  commands(
    commands:
      | CommandDefinitionMap<GameState>
      | CommandDefinitionList<GameState>,
  ):
    | GameDefinitionBuilder<GameState, CommandDefinitionMap<GameState>>
    | GameDefinitionBuilder<GameState, Commands> {
    if (Array.isArray(commands)) {
      this.config.commandList = commands;
      delete this.config.commands;

      return this as unknown as GameDefinitionBuilder<
        GameState,
        CommandDefinitionMap<GameState>
      >;
    }

    (
      this.config as unknown as GameDefinitionBuilderState<GameState, Commands>
    ).commands = commands as Commands;
    delete this.config.commandList;

    return this;
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

    if (!this.config.commands && !this.config.commandList) {
      throw new Error("commands_required");
    }

    const commands = this.config.commandList
      ? compileCommandList(this.config.commandList)
      : this.config.commands;

    return {
      name: this.config.name,
      initialState: this.config.initialState,
      commands: commands as Commands,
      progression: this.config.progression,
      rngSeed: this.config.rngSeed,
      setup: this.config.setup,
    };
  }
}

function compileCommandList<GameState extends object>(
  commands: CommandDefinitionList<GameState>,
): CommandDefinitionMap<GameState> {
  const commandMap: CommandDefinitionMap<GameState> = {};

  for (const command of commands) {
    if (command.commandId in commandMap) {
      throw new Error(`duplicate_command_id:${command.commandId}`);
    }

    commandMap[command.commandId] = command;
  }

  return commandMap;
}
