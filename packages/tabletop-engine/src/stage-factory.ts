import type { DefinedCommand } from "./types/command";
import {
  type CommandsFromDefinitions,
  stageDefinitionBrand,
  type AutomaticStageDefinition,
  type AutomaticStageRunContext,
  type AutomaticStageTransitionContext,
  type MultiActivePlayerMemoryContext,
  type MultiActivePlayerStageDefinition,
  type MultiActivePlayerSubmitContext,
  type MultiActivePlayerTransitionContext,
  type SingleActivePlayerSelectionContext,
  type SingleActivePlayerStageDefinition,
  type SingleActivePlayerTransitionContext,
  type StageDefinitionMap,
  type StageDefinitionResolver,
} from "./types/progression";
import { assertSerializableSchema } from "./schema";
import type { FieldType, ObjectFieldType } from "./schema";
import type { RuntimeState } from "./types/state";

type NoBuilderMethod = Record<never, never>;
type NoNextStages = Record<string, never>;
type TExtractNextStages<Resolver> = Resolver extends () => infer NextStages
  ? NextStages
  : never;

type SingleActivePlayerBuildMethod<
  GameState extends object,
  Commands extends readonly DefinedCommand<GameState>[],
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
            Commands,
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

type MultiActivePlayerBuildMethod<
  GameState extends object,
  Memory extends object,
  Commands extends readonly DefinedCommand<GameState>[],
  NextStages extends StageDefinitionMap<GameState>,
  HasMemory extends boolean,
  HasActivePlayers extends boolean,
  HasCommands extends boolean,
  HasOnSubmit extends boolean,
  HasIsComplete extends boolean,
  HasNextStages extends boolean,
  HasTransition extends boolean,
> = HasMemory extends true
  ? HasActivePlayers extends true
    ? HasCommands extends true
      ? HasOnSubmit extends true
        ? HasIsComplete extends true
          ? HasNextStages extends true
            ? HasTransition extends true
              ? {
                  build(): MultiActivePlayerStageDefinition<
                    GameState,
                    RuntimeState,
                    Memory,
                    Commands,
                    NextStages
                  >;
                }
              : NoBuilderMethod
            : NoBuilderMethod
          : NoBuilderMethod
        : NoBuilderMethod
      : NoBuilderMethod
    : NoBuilderMethod
  : NoBuilderMethod;

export type SingleActivePlayerStageBuilder<
  GameState extends object,
  Commands extends readonly DefinedCommand<GameState>[] =
    readonly DefinedCommand<GameState>[],
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
    Commands,
    NextStages,
    true,
    HasCommands,
    HasTransition
  >;
  commands<NextCommands extends readonly DefinedCommand<GameState>[]>(
    commands: NextCommands,
  ): SingleActivePlayerStageBuilder<
    GameState,
    NextCommands,
    NextStages,
    HasActivePlayer,
    true,
    HasTransition
  >;
  nextStages<TNextStages extends StageDefinitionMap<GameState>>(
    nextStages: StageDefinitionResolver<GameState, TNextStages>,
  ): SingleActivePlayerStageBuilder<
    GameState,
    Commands,
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
        CommandsFromDefinitions<Commands>,
        NextStages
      >,
    ) =>
      | SingleActivePlayerStageDefinition<GameState>
      | NextStages[keyof NextStages],
  ): SingleActivePlayerStageBuilder<
    GameState,
    Commands,
    NextStages,
    HasActivePlayer,
    HasCommands,
    true
  >;
} & SingleActivePlayerBuildMethod<
  GameState,
  Commands,
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

export type MultiActivePlayerStageBuilder<
  GameState extends object,
  Memory extends object = Record<string, never>,
  Commands extends readonly DefinedCommand<GameState>[] =
    readonly DefinedCommand<GameState>[],
  NextStages extends StageDefinitionMap<GameState> = NoNextStages,
  HasMemory extends boolean = false,
  HasActivePlayers extends boolean = false,
  HasCommands extends boolean = false,
  HasOnSubmit extends boolean = false,
  HasIsComplete extends boolean = false,
  HasNextStages extends boolean = false,
  HasTransition extends boolean = false,
> = {
  memory<NextMemory extends object>(
    memorySchema: ObjectFieldType<Record<string, FieldType>>,
    memory: () => NextMemory,
  ): MultiActivePlayerStageBuilder<
    GameState,
    NextMemory,
    Commands,
    NextStages,
    true,
    HasActivePlayers,
    HasCommands,
    HasOnSubmit,
    HasIsComplete,
    HasNextStages,
    HasTransition
  >;
  activePlayers(
    activePlayers: (
      context: MultiActivePlayerMemoryContext<GameState, RuntimeState, Memory>,
    ) => string[],
  ): MultiActivePlayerStageBuilder<
    GameState,
    Memory,
    Commands,
    NextStages,
    HasMemory,
    true,
    HasCommands,
    HasOnSubmit,
    HasIsComplete,
    HasNextStages,
    HasTransition
  >;
  commands<NextCommands extends readonly DefinedCommand<GameState>[]>(
    commands: NextCommands,
  ): MultiActivePlayerStageBuilder<
    GameState,
    Memory,
    NextCommands,
    NextStages,
    HasMemory,
    HasActivePlayers,
    true,
    HasOnSubmit,
    HasIsComplete,
    HasNextStages,
    HasTransition
  >;
  onSubmit(
    onSubmit: (
      context: MultiActivePlayerSubmitContext<
        GameState,
        RuntimeState,
        Memory,
        CommandsFromDefinitions<Commands>
      >,
    ) => void,
  ): MultiActivePlayerStageBuilder<
    GameState,
    Memory,
    Commands,
    NextStages,
    HasMemory,
    HasActivePlayers,
    HasCommands,
    true,
    HasIsComplete,
    HasNextStages,
    HasTransition
  >;
  isComplete(
    isComplete: (
      context: MultiActivePlayerMemoryContext<GameState, RuntimeState, Memory>,
    ) => boolean,
  ): MultiActivePlayerStageBuilder<
    GameState,
    Memory,
    Commands,
    NextStages,
    HasMemory,
    HasActivePlayers,
    HasCommands,
    HasOnSubmit,
    true,
    HasNextStages,
    HasTransition
  >;
  nextStages<TNextStages extends StageDefinitionMap<GameState>>(
    nextStages: StageDefinitionResolver<GameState, TNextStages>,
  ): MultiActivePlayerStageBuilder<
    GameState,
    Memory,
    Commands,
    TNextStages,
    HasMemory,
    HasActivePlayers,
    HasCommands,
    HasOnSubmit,
    HasIsComplete,
    true,
    HasTransition
  >;
  transition(
    transition: (
      context: MultiActivePlayerTransitionContext<
        GameState,
        RuntimeState,
        Memory,
        NextStages
      >,
    ) =>
      | MultiActivePlayerStageDefinition<GameState>
      | NextStages[keyof NextStages],
  ): MultiActivePlayerStageBuilder<
    GameState,
    Memory,
    Commands,
    NextStages,
    HasMemory,
    HasActivePlayers,
    HasCommands,
    HasOnSubmit,
    HasIsComplete,
    HasNextStages,
    true
  >;
} & MultiActivePlayerBuildMethod<
  GameState,
  Memory,
  Commands,
  NextStages,
  HasMemory,
  HasActivePlayers,
  HasCommands,
  HasOnSubmit,
  HasIsComplete,
  HasNextStages,
  HasTransition
>;

export interface StageFactory<GameState extends object = object> {
  (id: string): {
    singleActivePlayer(): SingleActivePlayerStageBuilder<GameState>;
    automatic(): AutomaticStageBuilder<GameState>;
    multiActivePlayer(): MultiActivePlayerStageBuilder<GameState>;
  };
}

type SingleActivePlayerAccumulator<
  GameState extends object,
  Commands extends readonly DefinedCommand<GameState>[],
  NextStages extends StageDefinitionMap<GameState>,
> = {
  id: string;
  kind: "activePlayer";
  activePlayer?: (
    context: SingleActivePlayerSelectionContext<GameState, RuntimeState>,
  ) => string;
  commands?: Commands;
  nextStages?: StageDefinitionResolver<GameState, NextStages>;
  transition?: (
    context: SingleActivePlayerTransitionContext<
      GameState,
      RuntimeState,
      CommandsFromDefinitions<Commands>,
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

type MultiActivePlayerAccumulator<
  GameState extends object,
  Memory extends object,
  Commands extends readonly DefinedCommand<GameState>[],
  NextStages extends StageDefinitionMap<GameState>,
> = {
  id: string;
  kind: "multiActivePlayer";
  memorySchema?: ObjectFieldType<Record<string, FieldType>>;
  memory?: () => Memory;
  activePlayers?: (
    context: MultiActivePlayerMemoryContext<GameState, RuntimeState, Memory>,
  ) => string[];
  commands?: Commands;
  onSubmit?: (
    context: MultiActivePlayerSubmitContext<
      GameState,
      RuntimeState,
      Memory,
      CommandsFromDefinitions<Commands>
    >,
  ) => void;
  isComplete?: (
    context: MultiActivePlayerMemoryContext<GameState, RuntimeState, Memory>,
  ) => boolean;
  nextStages?: StageDefinitionResolver<GameState, NextStages>;
  transition?: (
    context: MultiActivePlayerTransitionContext<
      GameState,
      RuntimeState,
      Memory,
      NextStages
    >,
  ) =>
    | MultiActivePlayerStageDefinition<GameState>
    | NextStages[keyof NextStages];
};

export function createStageFactory<
  GameState extends object,
>(): StageFactory<GameState> {
  return ((id: string) => {
    return {
      singleActivePlayer() {
        return createSingleActivePlayerBuilder<
          GameState,
          readonly DefinedCommand<GameState>[],
          NoNextStages
        >({
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
      multiActivePlayer() {
        return createMultiActivePlayerBuilder<
          GameState,
          Record<string, never>,
          readonly DefinedCommand<GameState>[],
          NoNextStages
        >({
          id,
          kind: "multiActivePlayer",
        });
      },
    };
  }) as StageFactory<GameState>;
}

function createSingleActivePlayerBuilder<
  GameState extends object,
  Commands extends readonly DefinedCommand<GameState>[],
  NextStages extends StageDefinitionMap<GameState>,
  HasActivePlayer extends boolean = false,
  HasCommands extends boolean = false,
  HasTransition extends boolean = false,
>(
  accumulator: SingleActivePlayerAccumulator<GameState, Commands, NextStages>,
): SingleActivePlayerStageBuilder<
  GameState,
  Commands,
  NextStages,
  HasActivePlayer,
  HasCommands,
  HasTransition
> {
  return {
    activePlayer(activePlayer) {
      return createSingleActivePlayerBuilder<
        GameState,
        Commands,
        NextStages,
        true,
        HasCommands,
        HasTransition
      >({
        ...accumulator,
        activePlayer,
      });
    },
    commands<NextCommands extends readonly DefinedCommand<GameState>[]>(
      commands: NextCommands,
    ) {
      return createSingleActivePlayerBuilder<
        GameState,
        NextCommands,
        NextStages,
        HasActivePlayer,
        true,
        HasTransition
      >({
        ...accumulator,
        commands,
      } as SingleActivePlayerAccumulator<GameState, NextCommands, NextStages>);
    },
    nextStages(nextStages) {
      const nextAccumulator = {
        ...accumulator,
        nextStages,
      } as SingleActivePlayerAccumulator<
        GameState,
        Commands,
        TExtractNextStages<typeof nextStages>
      >;

      return createSingleActivePlayerBuilder<
        GameState,
        Commands,
        TExtractNextStages<typeof nextStages>,
        HasActivePlayer,
        HasCommands,
        HasTransition
      >(nextAccumulator);
    },
    transition(transition) {
      return createSingleActivePlayerBuilder<
        GameState,
        Commands,
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
        Commands,
        NextStages
      >;
    },
  } as SingleActivePlayerStageBuilder<
    GameState,
    Commands,
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

function createMultiActivePlayerBuilder<
  GameState extends object,
  Memory extends object,
  Commands extends readonly DefinedCommand<GameState>[],
  NextStages extends StageDefinitionMap<GameState>,
  HasMemory extends boolean = false,
  HasActivePlayers extends boolean = false,
  HasCommands extends boolean = false,
  HasOnSubmit extends boolean = false,
  HasIsComplete extends boolean = false,
  HasNextStages extends boolean = false,
  HasTransition extends boolean = false,
>(
  accumulator: MultiActivePlayerAccumulator<
    GameState,
    Memory,
    Commands,
    NextStages
  >,
): MultiActivePlayerStageBuilder<
  GameState,
  Memory,
  Commands,
  NextStages,
  HasMemory,
  HasActivePlayers,
  HasCommands,
  HasOnSubmit,
  HasIsComplete,
  HasNextStages,
  HasTransition
> {
  return {
    memory<NextMemory extends object>(
      memorySchema: ObjectFieldType<Record<string, FieldType>>,
      memory: () => NextMemory,
    ) {
      assertSerializableSchema(memorySchema);

      return createMultiActivePlayerBuilder<
        GameState,
        NextMemory,
        Commands,
        NextStages,
        true,
        HasActivePlayers,
        HasCommands,
        HasOnSubmit,
        HasIsComplete,
        HasNextStages,
        HasTransition
      >({
        ...accumulator,
        memorySchema,
        memory,
      } as MultiActivePlayerAccumulator<
        GameState,
        NextMemory,
        Commands,
        NextStages
      >);
    },
    activePlayers(
      activePlayers: (
        context: MultiActivePlayerMemoryContext<
          GameState,
          RuntimeState,
          Memory
        >,
      ) => string[],
    ) {
      return createMultiActivePlayerBuilder<
        GameState,
        Memory,
        Commands,
        NextStages,
        HasMemory,
        true,
        HasCommands,
        HasOnSubmit,
        HasIsComplete,
        HasNextStages,
        HasTransition
      >({
        ...accumulator,
        activePlayers,
      });
    },
    commands<NextCommands extends readonly DefinedCommand<GameState>[]>(
      commands: NextCommands,
    ) {
      return createMultiActivePlayerBuilder<
        GameState,
        Memory,
        NextCommands,
        NextStages,
        HasMemory,
        HasActivePlayers,
        true,
        HasOnSubmit,
        HasIsComplete,
        HasNextStages,
        HasTransition
      >({
        ...accumulator,
        commands,
      } as MultiActivePlayerAccumulator<
        GameState,
        Memory,
        NextCommands,
        NextStages
      >);
    },
    onSubmit(
      onSubmit: (
        context: MultiActivePlayerSubmitContext<
          GameState,
          RuntimeState,
          Memory,
          CommandsFromDefinitions<Commands>
        >,
      ) => void,
    ) {
      return createMultiActivePlayerBuilder<
        GameState,
        Memory,
        Commands,
        NextStages,
        HasMemory,
        HasActivePlayers,
        HasCommands,
        true,
        HasIsComplete,
        HasNextStages,
        HasTransition
      >({
        ...accumulator,
        onSubmit,
      });
    },
    isComplete(
      isComplete: (
        context: MultiActivePlayerMemoryContext<
          GameState,
          RuntimeState,
          Memory
        >,
      ) => boolean,
    ) {
      return createMultiActivePlayerBuilder<
        GameState,
        Memory,
        Commands,
        NextStages,
        HasMemory,
        HasActivePlayers,
        HasCommands,
        HasOnSubmit,
        true,
        HasNextStages,
        HasTransition
      >({
        ...accumulator,
        isComplete,
      });
    },
    nextStages<TNextStages extends StageDefinitionMap<GameState>>(
      nextStages: StageDefinitionResolver<GameState, TNextStages>,
    ) {
      return createMultiActivePlayerBuilder<
        GameState,
        Memory,
        Commands,
        TNextStages,
        HasMemory,
        HasActivePlayers,
        HasCommands,
        HasOnSubmit,
        HasIsComplete,
        true,
        HasTransition
      >({
        ...accumulator,
        nextStages,
      } as MultiActivePlayerAccumulator<
        GameState,
        Memory,
        Commands,
        TNextStages
      >);
    },
    transition(
      transition: (
        context: MultiActivePlayerTransitionContext<
          GameState,
          RuntimeState,
          Memory,
          NextStages
        >,
      ) =>
        | MultiActivePlayerStageDefinition<GameState>
        | NextStages[keyof NextStages],
    ) {
      return createMultiActivePlayerBuilder<
        GameState,
        Memory,
        Commands,
        NextStages,
        HasMemory,
        HasActivePlayers,
        HasCommands,
        HasOnSubmit,
        HasIsComplete,
        HasNextStages,
        true
      >({
        ...accumulator,
        transition,
      });
    },
    build() {
      if (!accumulator.memory) {
        throw new Error("multi_active_player_stage_requires_memory");
      }

      if (!accumulator.memorySchema) {
        throw new Error("multi_active_player_stage_requires_memory_schema");
      }

      if (!accumulator.activePlayers) {
        throw new Error("multi_active_player_stage_requires_active_players");
      }

      if (!accumulator.commands) {
        throw new Error("multi_active_player_stage_requires_commands");
      }

      if (!accumulator.onSubmit) {
        throw new Error("multi_active_player_stage_requires_on_submit");
      }

      if (!accumulator.isComplete) {
        throw new Error("multi_active_player_stage_requires_is_complete");
      }

      if (!accumulator.nextStages) {
        throw new Error("multi_active_player_stage_requires_next_stages");
      }

      if (!accumulator.transition) {
        throw new Error("multi_active_player_stage_requires_transition");
      }

      return {
        id: accumulator.id,
        kind: "multiActivePlayer",
        memorySchema: accumulator.memorySchema,
        memory: accumulator.memory,
        activePlayers: accumulator.activePlayers,
        commands: accumulator.commands,
        onSubmit: accumulator.onSubmit,
        isComplete: accumulator.isComplete,
        nextStages: accumulator.nextStages,
        transition: accumulator.transition,
        [stageDefinitionBrand]: true,
      } as unknown as MultiActivePlayerStageDefinition<
        GameState,
        RuntimeState,
        Memory,
        Commands,
        NextStages
      >;
    },
  } as unknown as MultiActivePlayerStageBuilder<
    GameState,
    Memory,
    Commands,
    NextStages,
    HasMemory,
    HasActivePlayers,
    HasCommands,
    HasOnSubmit,
    HasIsComplete,
    HasNextStages,
    HasTransition
  >;
}
