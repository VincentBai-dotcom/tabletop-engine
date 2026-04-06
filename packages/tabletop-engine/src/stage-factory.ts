import type { DefinedCommand } from "./types/command";
import {
  stageDefinitionBrand,
  type AutomaticStageDefinition,
  type AutomaticStageRunContext,
  type AutomaticStageTransitionContext,
  type SingleActivePlayerSelectionContext,
  type SingleActivePlayerStageDefinition,
  type SingleActivePlayerTransitionContext,
  type StageDefinitionMap,
  type StageDefinitionResolver,
} from "./types/progression";
import type { RuntimeState } from "./types/state";

type NoBuilderMethod = Record<never, never>;
type NoNextStages = Record<string, never>;
type TExtractNextStages<Resolver> = Resolver extends () => infer NextStages
  ? NextStages
  : never;

type SingleActivePlayerBuildMethod<
  GameState extends object,
  NextStages extends StageDefinitionMap<GameState>,
  HasActivePlayer extends boolean,
  HasCommands extends boolean,
  HasTransition extends boolean,
> = HasActivePlayer extends true
  ? HasCommands extends true
    ? HasTransition extends true
      ? {
          build(): SingleActivePlayerStageDefinition<
            GameState,
            RuntimeState,
            NextStages
          >;
        }
      : NoBuilderMethod
    : NoBuilderMethod
  : NoBuilderMethod;

type AutomaticBuildMethod<
  GameState extends object,
  NextStages extends StageDefinitionMap<GameState>,
> = {
  build(): AutomaticStageDefinition<GameState, RuntimeState, NextStages>;
};

export type SingleActivePlayerStageBuilder<
  GameState extends object,
  NextStages extends StageDefinitionMap<GameState> = NoNextStages,
  HasActivePlayer extends boolean = false,
  HasCommands extends boolean = false,
  HasTransition extends boolean = false,
> = {
  activePlayer(
    activePlayer: (
      context: SingleActivePlayerSelectionContext<GameState, RuntimeState>,
    ) => string,
  ): SingleActivePlayerStageBuilder<
    GameState,
    NextStages,
    true,
    HasCommands,
    HasTransition
  >;
  commands(
    commands: readonly DefinedCommand<GameState>[],
  ): SingleActivePlayerStageBuilder<
    GameState,
    NextStages,
    HasActivePlayer,
    true,
    HasTransition
  >;
  nextStages<TNextStages extends StageDefinitionMap<GameState>>(
    nextStages: StageDefinitionResolver<GameState, TNextStages>,
  ): SingleActivePlayerStageBuilder<
    GameState,
    TNextStages,
    HasActivePlayer,
    HasCommands,
    HasTransition
  >;
  transition(
    transition: (
      context: SingleActivePlayerTransitionContext<
        GameState,
        RuntimeState,
        NextStages
      >,
    ) =>
      | SingleActivePlayerStageDefinition<GameState>
      | NextStages[keyof NextStages],
  ): SingleActivePlayerStageBuilder<
    GameState,
    NextStages,
    HasActivePlayer,
    HasCommands,
    true
  >;
} & SingleActivePlayerBuildMethod<
  GameState,
  NextStages,
  HasActivePlayer,
  HasCommands,
  HasTransition
>;

export type AutomaticStageBuilder<
  GameState extends object,
  NextStages extends StageDefinitionMap<GameState> = NoNextStages,
> = {
  run(
    run: (context: AutomaticStageRunContext<GameState, RuntimeState>) => void,
  ): AutomaticStageBuilder<GameState, NextStages>;
  nextStages<TNextStages extends StageDefinitionMap<GameState>>(
    nextStages: StageDefinitionResolver<GameState, TNextStages>,
  ): AutomaticStageBuilder<GameState, TNextStages>;
  transition(
    transition: (
      context: AutomaticStageTransitionContext<
        GameState,
        RuntimeState,
        NextStages
      >,
    ) => AutomaticStageDefinition<GameState> | NextStages[keyof NextStages],
  ): AutomaticStageBuilder<GameState, NextStages>;
} & AutomaticBuildMethod<GameState, NextStages>;

export interface StageFactory<GameState extends object = object> {
  (id: string): {
    singleActivePlayer(): SingleActivePlayerStageBuilder<GameState>;
    automatic(): AutomaticStageBuilder<GameState>;
  };
}

type SingleActivePlayerAccumulator<
  GameState extends object,
  NextStages extends StageDefinitionMap<GameState>,
> = {
  id: string;
  kind: "activePlayer";
  activePlayer?: (
    context: SingleActivePlayerSelectionContext<GameState, RuntimeState>,
  ) => string;
  commands?: readonly DefinedCommand<GameState>[];
  nextStages?: StageDefinitionResolver<GameState, NextStages>;
  transition?: (
    context: SingleActivePlayerTransitionContext<
      GameState,
      RuntimeState,
      NextStages
    >,
  ) =>
    | SingleActivePlayerStageDefinition<GameState>
    | NextStages[keyof NextStages];
};

type AutomaticAccumulator<
  GameState extends object,
  NextStages extends StageDefinitionMap<GameState>,
> = {
  id: string;
  kind: "automatic";
  run?: (context: AutomaticStageRunContext<GameState, RuntimeState>) => void;
  nextStages?: StageDefinitionResolver<GameState, NextStages>;
  transition?: (
    context: AutomaticStageTransitionContext<
      GameState,
      RuntimeState,
      NextStages
    >,
  ) => AutomaticStageDefinition<GameState> | NextStages[keyof NextStages];
};

export function createStageFactory<
  GameState extends object,
>(): StageFactory<GameState> {
  return ((id: string) => {
    return {
      singleActivePlayer() {
        return createSingleActivePlayerBuilder<GameState, NoNextStages>({
          id,
          kind: "activePlayer",
        });
      },
      automatic() {
        return createAutomaticBuilder<GameState, NoNextStages>({
          id,
          kind: "automatic",
        });
      },
    };
  }) as StageFactory<GameState>;
}

function createSingleActivePlayerBuilder<
  GameState extends object,
  NextStages extends StageDefinitionMap<GameState>,
  HasActivePlayer extends boolean = false,
  HasCommands extends boolean = false,
  HasTransition extends boolean = false,
>(
  accumulator: SingleActivePlayerAccumulator<GameState, NextStages>,
): SingleActivePlayerStageBuilder<
  GameState,
  NextStages,
  HasActivePlayer,
  HasCommands,
  HasTransition
> {
  return {
    activePlayer(activePlayer) {
      return createSingleActivePlayerBuilder<
        GameState,
        NextStages,
        true,
        HasCommands,
        HasTransition
      >({
        ...accumulator,
        activePlayer,
      });
    },
    commands(commands) {
      return createSingleActivePlayerBuilder<
        GameState,
        NextStages,
        HasActivePlayer,
        true,
        HasTransition
      >({
        ...accumulator,
        commands,
      });
    },
    nextStages(nextStages) {
      const nextAccumulator = {
        ...accumulator,
        nextStages,
      } as SingleActivePlayerAccumulator<
        GameState,
        TExtractNextStages<typeof nextStages>
      >;

      return createSingleActivePlayerBuilder<
        GameState,
        TExtractNextStages<typeof nextStages>,
        HasActivePlayer,
        HasCommands,
        HasTransition
      >(nextAccumulator);
    },
    transition(transition) {
      return createSingleActivePlayerBuilder<
        GameState,
        NextStages,
        HasActivePlayer,
        HasCommands,
        true
      >({
        ...accumulator,
        transition,
      });
    },
    build() {
      if (!accumulator.activePlayer) {
        throw new Error("single_active_player_stage_requires_active_player");
      }

      if (!accumulator.commands) {
        throw new Error("single_active_player_stage_requires_commands");
      }

      if (!accumulator.transition) {
        throw new Error("single_active_player_stage_requires_transition");
      }

      return {
        id: accumulator.id,
        kind: "activePlayer",
        activePlayer: accumulator.activePlayer,
        commands: accumulator.commands,
        nextStages: accumulator.nextStages,
        transition: accumulator.transition,
        [stageDefinitionBrand]: true,
      } as SingleActivePlayerStageDefinition<
        GameState,
        RuntimeState,
        NextStages
      >;
    },
  } as SingleActivePlayerStageBuilder<
    GameState,
    NextStages,
    HasActivePlayer,
    HasCommands,
    HasTransition
  >;
}

function createAutomaticBuilder<
  GameState extends object,
  NextStages extends StageDefinitionMap<GameState>,
>(
  accumulator: AutomaticAccumulator<GameState, NextStages>,
): AutomaticStageBuilder<GameState, NextStages> {
  return {
    run(run) {
      return createAutomaticBuilder({
        ...accumulator,
        run,
      });
    },
    nextStages(nextStages) {
      return createAutomaticBuilder<
        GameState,
        TExtractNextStages<typeof nextStages>
      >({
        ...accumulator,
        nextStages,
      } as AutomaticAccumulator<
        GameState,
        TExtractNextStages<typeof nextStages>
      >);
    },
    transition(transition) {
      return createAutomaticBuilder({
        ...accumulator,
        transition,
      });
    },
    build() {
      return {
        id: accumulator.id,
        kind: "automatic",
        run: accumulator.run,
        nextStages: accumulator.nextStages,
        transition: accumulator.transition,
        [stageDefinitionBrand]: true,
      } as AutomaticStageDefinition<GameState, RuntimeState, NextStages>;
    },
  };
}
