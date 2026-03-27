import type { CommandDefinition, CommandInput } from "./types/command";
import type { ProgressionDefinition } from "./types/progression";
import type { RuntimeState } from "./types/state";
import type { RNGApi } from "./types/rng";
import {
  compileStateFacadeDefinition,
  type CompiledStateFacadeDefinition,
} from "./state-facade/compile";
import type { StateClass } from "./state-facade/metadata";

type AnyCommandDefinition<GameState extends object> = CommandDefinition<
  GameState,
  CommandInput
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
  stateFacade?: CompiledStateFacadeDefinition;
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
  rootState?: StateClass;
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

  commands(
    commands: CommandDefinitionMap<GameState>,
  ): GameDefinitionBuilder<GameState, CommandDefinitionMap<GameState>>;
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
      this.config as unknown as GameDefinitionBuilderState<
        GameState,
        CommandDefinitionMap<GameState>
      >
    ).commands = commands as CommandDefinitionMap<GameState>;
    delete this.config.commandList;

    return this as unknown as GameDefinitionBuilder<
      GameState,
      CommandDefinitionMap<GameState>
    >;
  }

  rootState(rootState: StateClass): this {
    this.config.rootState = rootState;
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
    const stateFacade = this.config.rootState
      ? compileStateFacadeDefinition(this.config.rootState)
      : undefined;

    return {
      name: this.config.name,
      initialState: this.config.initialState,
      commands: commands as Commands,
      stateFacade,
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
