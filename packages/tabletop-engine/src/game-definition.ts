import type { CommandDefinition } from "./types/command";
import type { StageDefinition, StageDefinitionMap } from "./types/progression";
import type { RuntimeState } from "./types/state";
import type { RNGApi } from "./types/rng";
import {
  compileStateFacadeDefinition,
  type CompiledStateFacadeDefinition,
} from "./state-facade/compile";
import { compileCanonicalGameStateSchema } from "./state-facade/canonical";
import { createDefaultCanonicalGameState } from "./state-facade/canonical";
import { compileRuntimeStateSchema } from "./runtime/runtime-schema";
import { assertSchemaValue } from "./runtime/validation";
import type { StateClass } from "./state-facade/metadata";
import type { ObjectFieldType, FieldType } from "./schema";
import type { TSchema } from "@sinclair/typebox";

type AnyCommandDefinition<FacadeGameState extends object> =
  CommandDefinition<FacadeGameState>;

type CommandDefinitionMap<FacadeGameState extends object = object> = Record<
  string,
  AnyCommandDefinition<FacadeGameState>
>;

type AnyStageDefinition = StageDefinition<object>;

type NonFunctionPropertyKeys<TObject> = {
  [K in keyof TObject]: TObject[K] extends (...args: never[]) => unknown
    ? never
    : K;
}[keyof TObject];

type CanonicalGameStateShape<TState> = TState extends readonly (infer TItem)[]
  ? CanonicalGameStateShape<TItem>[]
  : TState extends object
    ? {
        [K in NonFunctionPropertyKeys<TState>]: CanonicalGameStateShape<
          TState[K]
        >;
      }
    : TState;

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
  commands: Commands;
  stateFacade: CompiledStateFacadeDefinition;
  canonicalGameStateSchema: ObjectFieldType<Record<string, FieldType>>;
  runtimeStateSchema: TSchema;
  defaultCanonicalGameState: CanonicalGameState;
  initialStage: AnyStageDefinition;
  stages: Record<string, AnyStageDefinition>;
  rngSeed?: string | number;
  setup?: (context: GameSetupContext<FacadeGameState>) => void;
}

export interface GameDefinitionInput<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Commands extends CommandDefinitionMap<FacadeGameState> =
    CommandDefinitionMap<FacadeGameState>,
> extends Omit<
  GameDefinition<CanonicalGameState, FacadeGameState, Commands>,
  | "name"
  | "commands"
  | "stateFacade"
  | "canonicalGameStateSchema"
  | "runtimeStateSchema"
  | "defaultCanonicalGameState"
  | "stages"
> {
  name: string;
}

interface GameDefinitionBuilderState<
  FacadeGameState extends object = object,
  CanonicalGameState extends object = CanonicalGameStateShape<FacadeGameState>,
  Commands extends CommandDefinitionMap<FacadeGameState> =
    CommandDefinitionMap<FacadeGameState>,
> extends Partial<
  Omit<
    GameDefinition<CanonicalGameState, FacadeGameState, Commands>,
    | "commands"
    | "stateFacade"
    | "canonicalGameStateSchema"
    | "runtimeStateSchema"
    | "defaultCanonicalGameState"
    | "stages"
    | "setup"
  >
> {
  name: string;
  rootState?: StateClass;
  initialStage?: AnyStageDefinition;
  setup?: (context: GameSetupContext<FacadeGameState>) => void;
}

export class GameDefinitionBuilder<
  FacadeGameState extends object = object,
  CanonicalGameState extends object = CanonicalGameStateShape<FacadeGameState>,
  Commands extends CommandDefinitionMap<FacadeGameState> =
    CommandDefinitionMap<FacadeGameState>,
> {
  private readonly config: GameDefinitionBuilderState<
    FacadeGameState,
    CanonicalGameState,
    Commands
  >;

  constructor(name: string) {
    this.config = {
      name,
    };
  }

  rootState<NextFacadeGameState extends object>(
    rootState: StateClass<NextFacadeGameState>,
  ): GameDefinitionBuilder<
    NextFacadeGameState,
    CanonicalGameStateShape<NextFacadeGameState>,
    CommandDefinitionMap<NextFacadeGameState>
  > {
    this.config.rootState = rootState;
    return this as unknown as GameDefinitionBuilder<
      NextFacadeGameState,
      CanonicalGameStateShape<NextFacadeGameState>,
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

  build(): GameDefinition<CanonicalGameState, FacadeGameState, Commands> {
    if (!this.config.rootState) {
      throw new Error("root_state_required");
    }

    if (!this.config.initialStage) {
      throw new Error("initial_stage_required");
    }

    const stages = collectReachableStages(this.config.initialStage);
    const commands = compileCommandMapFromStages(stages);
    const stateFacade = compileStateFacadeDefinition(this.config.rootState);
    const canonicalGameStateSchema = compileCanonicalGameStateSchema(
      this.config.rootState,
    );
    const runtimeStateSchema = compileRuntimeStateSchema(
      stages as Record<string, AnyStageDefinition>,
    );
    const defaultCanonicalGameState = createDefaultCanonicalGameState(
      this.config.rootState,
    );
    assertSchemaValue(canonicalGameStateSchema, defaultCanonicalGameState);

    return {
      name: this.config.name,
      commands: commands as Commands,
      stateFacade,
      canonicalGameStateSchema,
      runtimeStateSchema,
      defaultCanonicalGameState:
        defaultCanonicalGameState as CanonicalGameState,
      initialStage: this.config.initialStage,
      stages,
      rngSeed: this.config.rngSeed,
      setup: this.config.setup as unknown as
        | ((context: GameSetupContext<FacadeGameState>) => void)
        | undefined,
    };
  }

  setup(setup: (context: GameSetupContext<FacadeGameState>) => void): this {
    this.config.setup = setup;
    return this;
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
    if (stage.kind === "activePlayer" || stage.kind === "multiActivePlayer") {
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
