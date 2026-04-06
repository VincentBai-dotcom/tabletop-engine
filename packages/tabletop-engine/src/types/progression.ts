import type { Command, DefinedCommand } from "./command";
import type { GameEvent } from "./event";
import type { RNGApi } from "./rng";
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

export type StageState = SingleActivePlayerStageState | AutomaticStageState;

export interface ProgressionState {
  currentStage: StageState;
  lastActingStage: SingleActivePlayerStageState | null;
}

export type StageDefinitionMap<FacadeGameState extends object = object> =
  Record<string, StageDefinition<FacadeGameState>>;

export type StageDefinitionResolver<
  FacadeGameState extends object = object,
  NextStages extends StageDefinitionMap<FacadeGameState> =
    StageDefinitionMap<FacadeGameState>,
> = () => NextStages;

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
  NextStages extends StageDefinitionMap<GameState> =
    StageDefinitionMap<GameState>,
> {
  game: Readonly<GameState>;
  runtime: Readonly<Runtime>;
  command: Command;
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

export interface SingleActivePlayerStageDefinition<
  GameState extends object = object,
  Runtime = RuntimeState,
  NextStages extends StageDefinitionMap<GameState> =
    StageDefinitionMap<GameState>,
> extends StageDefinitionBrand {
  id: string;
  kind: "activePlayer";
  activePlayer(
    context: SingleActivePlayerSelectionContext<GameState, Runtime>,
  ): string;
  commands: readonly DefinedCommand<GameState>[];
  nextStages?: StageDefinitionResolver<GameState, NextStages>;
  transition(
    context: SingleActivePlayerTransitionContext<
      GameState,
      Runtime,
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

export type StageDefinition<GameState extends object = object> =
  | SingleActivePlayerStageDefinition<GameState>
  | AutomaticStageDefinition<GameState>;
