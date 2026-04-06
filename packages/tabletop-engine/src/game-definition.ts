import type { CommandDefinition } from "./types/command";
import type { StageDefinition, StageDefinitionMap } from "./types/progression";
import type { RuntimeState } from "./types/state";
import type { RNGApi } from "./types/rng";
import {
  compileStateFacadeDefinition,
  type CompiledStateFacadeDefinition,
} from "./state-facade/compile";
import type { StateClass } from "./state-facade/metadata";

type AnyCommandDefinition<FacadeGameState extends object> =
  CommandDefinition<FacadeGameState>;

type CommandDefinitionMap<FacadeGameState extends object = object> = Record<
  string,
  AnyCommandDefinition<FacadeGameState>
>;

type AnyStageDefinition = StageDefinition<object>;

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
  initialStage: AnyStageDefinition;
  stages: Record<string, AnyStageDefinition>;
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
  rootState?: StateClass;
  initialStage?: AnyStageDefinition;
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

  initialStage(initialStage: AnyStageDefinition): this {
    this.config.initialStage = initialStage;
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

    if (!this.config.initialStage) {
      throw new Error("initial_stage_required");
    }

    const stages = collectReachableStages(this.config.initialStage);
    const commands = compileCommandMapFromStages(stages);
    const stateFacade = this.config.rootState
      ? compileStateFacadeDefinition(this.config.rootState)
      : undefined;

    return {
      name: this.config.name,
      initialState: this.config.initialState,
      commands: commands as Commands,
      stateFacade,
      initialStage: this.config.initialStage,
      stages,
      rngSeed: this.config.rngSeed,
      setup: this.config.setup,
    };
  }
}

function collectReachableStages<FacadeGameState extends object>(
  initialStage: StageDefinition<FacadeGameState>,
): Record<string, StageDefinition<FacadeGameState>> {
  const stages: Record<string, StageDefinition<FacadeGameState>> = {};
  const stack = [initialStage];

  while (stack.length > 0) {
    const stage = stack.pop()!;
    const existing = stages[stage.id];

    if (existing) {
      if (existing !== stage) {
        throw new Error(`duplicate_stage_id:${stage.id}`);
      }

      continue;
    }

    stages[stage.id] = stage;

    for (const nextStage of Object.values(resolveNextStages(stage))) {
      stack.push(nextStage);
    }
  }

  return stages;
}

function resolveNextStages<FacadeGameState extends object>(
  stage: StageDefinition<FacadeGameState>,
): StageDefinitionMap<FacadeGameState> {
  return stage.nextStages?.() ?? {};
}

function compileCommandMapFromStages<FacadeGameState extends object>(
  stages: Record<string, StageDefinition<FacadeGameState>>,
): CommandDefinitionMap<FacadeGameState> {
  const commandMap: CommandDefinitionMap<FacadeGameState> = {};
  for (const stage of Object.values(stages)) {
    if (stage.kind === "activePlayer") {
      for (const command of stage.commands) {
        const existing = commandMap[command.commandId];

        if (existing && existing !== command) {
          throw new Error(`duplicate_command_id:${command.commandId}`);
        }

        commandMap[command.commandId] = command;
      }
    }
  }

  return commandMap;
}
