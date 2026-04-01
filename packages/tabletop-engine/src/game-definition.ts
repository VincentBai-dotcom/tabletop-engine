import type { CommandDefinitionLike, DefinedCommand } from "./types/command";
import type { ProgressionDefinition } from "./types/progression";
import type { RuntimeState } from "./types/state";
import type { RNGApi } from "./types/rng";
import {
  compileStateFacadeDefinition,
  type CompiledStateFacadeDefinition,
} from "./state-facade/compile";
import type { StateClass } from "./state-facade/metadata";

type AnyCommandDefinition<FacadeGameState extends object> =
  CommandDefinitionLike<FacadeGameState>;

type AuthoredCommandDefinition<FacadeGameState extends object> =
  DefinedCommand<FacadeGameState>;

type CommandDefinitionMap<FacadeGameState extends object = object> = Record<
  string,
  AnyCommandDefinition<FacadeGameState>
>;

type AuthoredCommandDefinitionMap<FacadeGameState extends object> = Record<
  string,
  AuthoredCommandDefinition<FacadeGameState>
>;

type CommandDefinitionList<FacadeGameState extends object> =
  readonly AuthoredCommandDefinition<FacadeGameState>[];

export interface GameSetupContext<GameState extends object = object> {
  game: GameState;
  runtime: RuntimeState;
  rng: RNGApi;
  playerIds: readonly string[];
}

export interface GameDefinition<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Commands extends CommandDefinitionMap<FacadeGameState> =
    CommandDefinitionMap<FacadeGameState>,
> {
  name: string;
  initialState: () => CanonicalGameState;
  commands: Commands;
  stateFacade?: CompiledStateFacadeDefinition;
  progression?: ProgressionDefinition<FacadeGameState>;
  rngSeed?: string | number;
  setup?: (context: GameSetupContext<CanonicalGameState>) => void;
}

export interface GameDefinitionInput<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Commands extends CommandDefinitionMap<FacadeGameState> =
    CommandDefinitionMap<FacadeGameState>,
> extends Omit<
  GameDefinition<CanonicalGameState, FacadeGameState, Commands>,
  "name"
> {
  name: string;
}

interface GameDefinitionBuilderState<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Commands extends CommandDefinitionMap<FacadeGameState> =
    CommandDefinitionMap<FacadeGameState>,
> extends Partial<
  GameDefinition<CanonicalGameState, FacadeGameState, Commands>
> {
  name: string;
  commandList?: CommandDefinitionList<FacadeGameState>;
  rootState?: StateClass;
}

export class GameDefinitionBuilder<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Commands extends CommandDefinitionMap<FacadeGameState> =
    CommandDefinitionMap<FacadeGameState>,
> {
  private readonly config: GameDefinitionBuilderState<
    CanonicalGameState,
    FacadeGameState,
    Commands
  >;

  constructor(name: string) {
    this.config = {
      name,
    };
  }

  initialState<NextCanonicalGameState extends object>(
    initialState: () => NextCanonicalGameState,
  ): GameDefinitionBuilder<
    NextCanonicalGameState,
    FacadeGameState extends CanonicalGameState
      ? NextCanonicalGameState
      : FacadeGameState,
    CommandDefinitionMap<
      FacadeGameState extends CanonicalGameState
        ? NextCanonicalGameState
        : FacadeGameState
    >
  > {
    (
      this.config as unknown as GameDefinitionBuilderState<
        NextCanonicalGameState,
        FacadeGameState extends CanonicalGameState
          ? NextCanonicalGameState
          : FacadeGameState,
        CommandDefinitionMap<
          FacadeGameState extends CanonicalGameState
            ? NextCanonicalGameState
            : FacadeGameState
        >
      >
    ).initialState = initialState;

    return this as unknown as GameDefinitionBuilder<
      NextCanonicalGameState,
      FacadeGameState extends CanonicalGameState
        ? NextCanonicalGameState
        : FacadeGameState,
      CommandDefinitionMap<
        FacadeGameState extends CanonicalGameState
          ? NextCanonicalGameState
          : FacadeGameState
      >
    >;
  }

  commands(
    commands: AuthoredCommandDefinitionMap<FacadeGameState>,
  ): GameDefinitionBuilder<
    CanonicalGameState,
    FacadeGameState,
    CommandDefinitionMap<FacadeGameState>
  >;
  commands(
    commands: CommandDefinitionList<FacadeGameState>,
  ): GameDefinitionBuilder<
    CanonicalGameState,
    FacadeGameState,
    CommandDefinitionMap<FacadeGameState>
  >;
  commands(
    commands:
      | AuthoredCommandDefinitionMap<FacadeGameState>
      | CommandDefinitionList<FacadeGameState>,
  ):
    | GameDefinitionBuilder<
        CanonicalGameState,
        FacadeGameState,
        CommandDefinitionMap<FacadeGameState>
      >
    | GameDefinitionBuilder<CanonicalGameState, FacadeGameState, Commands> {
    if (Array.isArray(commands)) {
      this.config.commandList = commands;
      delete this.config.commands;

      return this as unknown as GameDefinitionBuilder<
        CanonicalGameState,
        FacadeGameState,
        CommandDefinitionMap<FacadeGameState>
      >;
    }

    (
      this.config as unknown as GameDefinitionBuilderState<
        CanonicalGameState,
        FacadeGameState,
        CommandDefinitionMap<FacadeGameState>
      >
    ).commands = commands as AuthoredCommandDefinitionMap<FacadeGameState>;
    delete this.config.commandList;

    return this as unknown as GameDefinitionBuilder<
      CanonicalGameState,
      FacadeGameState,
      CommandDefinitionMap<FacadeGameState>
    >;
  }

  rootState<NextFacadeGameState extends object>(
    rootState: StateClass<NextFacadeGameState>,
  ): GameDefinitionBuilder<
    CanonicalGameState,
    NextFacadeGameState,
    CommandDefinitionMap<NextFacadeGameState>
  > {
    this.config.rootState = rootState;
    return this as unknown as GameDefinitionBuilder<
      CanonicalGameState,
      NextFacadeGameState,
      CommandDefinitionMap<NextFacadeGameState>
    >;
  }

  progression(progression: ProgressionDefinition<FacadeGameState>): this {
    this.config.progression = progression;
    return this;
  }

  rngSeed(rngSeed: string | number | undefined): this {
    this.config.rngSeed = rngSeed;
    return this;
  }

  setup(setup: (context: GameSetupContext<CanonicalGameState>) => void): this {
    this.config.setup = setup;
    return this;
  }

  build(): GameDefinition<CanonicalGameState, FacadeGameState, Commands> {
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

function compileCommandList<FacadeGameState extends object>(
  commands: CommandDefinitionList<FacadeGameState>,
): CommandDefinitionMap<FacadeGameState> {
  const commandMap: CommandDefinitionMap<FacadeGameState> = {};

  for (const command of commands) {
    if (command.commandId in commandMap) {
      throw new Error(`duplicate_command_id:${command.commandId}`);
    }

    commandMap[command.commandId] = command;
  }

  return commandMap;
}
