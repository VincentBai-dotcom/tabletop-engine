import type { Command, DefinedCommand } from "./command";
import type { GameEvent } from "./event";
import type { RNGApi } from "./rng";
import type { FieldType, ObjectFieldType } from "../schema";
import type { RuntimeState } from "./state";

export const stageDefinitionBrand = Symbol("tabletop-engine.stage-definition");

type StageDefinitionBrand = {
  readonly [stageDefinitionBrand]: true;
};

export interface SingleActivePlayerStageState {
  id: string;
  kind: "activePlayer";
  activePlayerId: string;
}

export interface AutomaticStageState {
  id: string;
  kind: "automatic";
}

export interface MultiActivePlayerStageState<Memory extends object = object> {
  id: string;
  kind: "multiActivePlayer";
  activePlayerIds: string[];
  memory: Memory;
}

export type StageState =
  | SingleActivePlayerStageState
  | AutomaticStageState
  | MultiActivePlayerStageState;

export interface ProgressionState {
  currentStage: StageState;
  lastActingStage:
    | SingleActivePlayerStageState
    | MultiActivePlayerStageState<object>
    | null;
}

export type StageDefinitionMap<FacadeGameState extends object = object> =
  Record<string, StageDefinition<FacadeGameState>>;

export type StageDefinitionResolver<
  FacadeGameState extends object = object,
  NextStages extends StageDefinitionMap<FacadeGameState> =
    StageDefinitionMap<FacadeGameState>,
> = () => NextStages;

type CommandFromDefinition<Definition> =
  Definition extends DefinedCommand<
    infer GameState extends object,
    infer Input extends Record<string, unknown>,
    infer DiscoveryInput extends Record<string, unknown>
  >
    ? [GameState, DiscoveryInput] extends [object, Record<string, unknown>]
      ? Command<Input>
      : never
    : never;

export type CommandsFromDefinitions<Definitions extends readonly unknown[]> =
  CommandFromDefinition<Definitions[number]>;

export interface SingleActivePlayerSelectionContext<
  GameState extends object = object,
  Runtime = RuntimeState,
> {
  game: Readonly<GameState>;
  runtime: Readonly<Runtime>;
}

export interface SingleActivePlayerTransitionContext<
  GameState extends object = object,
  Runtime = RuntimeState,
  TCommand extends Command = Command,
  NextStages extends StageDefinitionMap<GameState> =
    StageDefinitionMap<GameState>,
> {
  game: Readonly<GameState>;
  runtime: Readonly<Runtime>;
  command: TCommand;
  nextStages: Readonly<NextStages>;
}

export interface AutomaticStageRunContext<
  GameState extends object = object,
  Runtime = RuntimeState,
> {
  game: GameState;
  runtime: Readonly<Runtime>;
  rng: RNGApi;
  emitEvent(event: GameEvent): void;
}

export interface AutomaticStageTransitionContext<
  GameState extends object = object,
  Runtime = RuntimeState,
  NextStages extends StageDefinitionMap<GameState> =
    StageDefinitionMap<GameState>,
> {
  game: Readonly<GameState>;
  runtime: Readonly<Runtime>;
  nextStages: Readonly<NextStages>;
}

export interface MultiActivePlayerMemoryContext<
  GameState extends object = object,
  Runtime = RuntimeState,
  Memory extends object = object,
> {
  game: Readonly<GameState>;
  runtime: Readonly<Runtime>;
  memory: Memory;
}

export interface MultiActivePlayerSubmitContext<
  GameState extends object = object,
  Runtime = RuntimeState,
  Memory extends object = object,
  TCommand extends Command = Command,
> extends MultiActivePlayerMemoryContext<GameState, Runtime, Memory> {
  command: TCommand;
  execute(command: TCommand): void;
}

export interface MultiActivePlayerTransitionContext<
  GameState extends object = object,
  Runtime = RuntimeState,
  Memory extends object = object,
  NextStages extends StageDefinitionMap<GameState> =
    StageDefinitionMap<GameState>,
> extends MultiActivePlayerMemoryContext<GameState, Runtime, Memory> {
  nextStages: Readonly<NextStages>;
}

export interface SingleActivePlayerStageDefinition<
  GameState extends object = object,
  Runtime = RuntimeState,
  Commands extends readonly DefinedCommand<GameState>[] =
    readonly DefinedCommand<GameState>[],
  NextStages extends StageDefinitionMap<GameState> =
    StageDefinitionMap<GameState>,
> extends StageDefinitionBrand {
  id: string;
  kind: "activePlayer";
  activePlayer(
    context: SingleActivePlayerSelectionContext<GameState, Runtime>,
  ): string;
  commands: Commands;
  nextStages?: StageDefinitionResolver<GameState, NextStages>;
  transition(
    context: SingleActivePlayerTransitionContext<
      GameState,
      Runtime,
      CommandsFromDefinitions<Commands>,
      NextStages
    >,
  ):
    | SingleActivePlayerStageDefinition<GameState>
    | NextStages[keyof NextStages];
}

export interface AutomaticStageDefinition<
  GameState extends object = object,
  Runtime = RuntimeState,
  NextStages extends StageDefinitionMap<GameState> =
    StageDefinitionMap<GameState>,
> extends StageDefinitionBrand {
  id: string;
  kind: "automatic";
  run?(context: AutomaticStageRunContext<GameState, Runtime>): void;
  nextStages?: StageDefinitionResolver<GameState, NextStages>;
  transition?(
    context: AutomaticStageTransitionContext<GameState, Runtime, NextStages>,
  ): AutomaticStageDefinition<GameState> | NextStages[keyof NextStages];
}

export interface MultiActivePlayerStageDefinition<
  GameState extends object = object,
  Runtime = RuntimeState,
  Memory extends object = object,
  Commands extends readonly DefinedCommand<GameState>[] =
    readonly DefinedCommand<GameState>[],
  NextStages extends StageDefinitionMap<GameState> =
    StageDefinitionMap<GameState>,
> extends StageDefinitionBrand {
  id: string;
  kind: "multiActivePlayer";
  memorySchema: ObjectFieldType<Record<string, FieldType>>;
  memory(): Memory;
  activePlayers(
    context: MultiActivePlayerMemoryContext<GameState, Runtime, Memory>,
  ): string[];
  commands: Commands;
  onSubmit(
    context: MultiActivePlayerSubmitContext<
      GameState,
      Runtime,
      Memory,
      CommandsFromDefinitions<Commands>
    >,
  ): void;
  isComplete(
    context: MultiActivePlayerMemoryContext<GameState, Runtime, Memory>,
  ): boolean;
  nextStages?: StageDefinitionResolver<GameState, NextStages>;
  transition(
    context: MultiActivePlayerTransitionContext<
      GameState,
      Runtime,
      Memory,
      NextStages
    >,
  ): MultiActivePlayerStageDefinition<GameState> | NextStages[keyof NextStages];
}

export type StageDefinition<GameState extends object = object> =
  | SingleActivePlayerStageDefinition<GameState>
  | AutomaticStageDefinition<GameState>
  | MultiActivePlayerStageDefinition<GameState>;
