import type { GameDefinition } from "../game-definition";
import {
  createCommandAvailabilityContext,
  createDiscoveryContext,
  createExecuteContext,
  createValidationContext,
} from "./contexts";
import {
  createEventCollector,
  createStageEnteredEvent,
  createStageExitedEvent,
} from "./events";
import { cloneCanonicalState } from "./transaction";
import type {
  CommandDefinition,
  Command,
  Discovery,
  InternalCommandDefinition,
} from "../types/command";
import type { CommandDiscoveryResult } from "../types/command";
import type { GameEvent } from "../types/event";
import type {
  MultiActivePlayerStageState,
  SingleActivePlayerStageState,
  StageDefinition,
  StageState,
} from "../types/progression";
import type {
  ExecutionFailure,
  ExecutionResult,
  ExecutionSuccess,
} from "../types/result";
import type { CanonicalState, RuntimeState } from "../types/state";
import type { Viewer, VisibleState } from "../types/visibility";
import { createRNGService } from "../rng/service";
import { hydrateStateFacade } from "../state-facade/hydrate";
import { getView as getVisibleStateView } from "../state-facade/project";

type CommandDefinitions<
  CanonicalGameState extends object,
  FacadeGameState extends object = CanonicalGameState,
> = Record<
  string,
  InternalCommandDefinition<CanonicalGameState, FacadeGameState, RuntimeState>
>;

export interface GameExecutor<GameState extends object> {
  createInitialState(options?: {
    playerIds?: readonly string[];
  }): CanonicalState<GameState>;
  getView(
    state: CanonicalState<GameState>,
    viewer: Viewer,
  ): VisibleState<object>;
  listAvailableCommands(
    state: CanonicalState<GameState>,
    options: {
      actorId: string;
    },
  ): string[];
  discoverCommand(
    state: CanonicalState<GameState>,
    discovery: Discovery,
  ): CommandDiscoveryResult | null;
  executeCommand(
    state: CanonicalState<GameState>,
    command: Command,
  ): ExecutionResult<CanonicalState<GameState>>;
}

function createCommandGameView<
  CanonicalGameState extends object,
  FacadeGameState extends object = CanonicalGameState,
>(
  game: GameDefinition<
    CanonicalGameState,
    FacadeGameState,
    CommandDefinitions<CanonicalGameState, FacadeGameState>
  >,
  state: CanonicalState<CanonicalGameState>,
  options?: {
    readonly?: boolean;
  },
): FacadeGameState {
  return hydrateStateFacade(game.stateFacade, state.game, {
    readonly: options?.readonly ?? false,
  });
}

function createInitialRuntimeState<
  CanonicalGameState extends object,
  FacadeGameState extends object = CanonicalGameState,
>(
  game: GameDefinition<
    CanonicalGameState,
    FacadeGameState,
    CommandDefinitions<CanonicalGameState, FacadeGameState>
  >,
): RuntimeState {
  const runtime: RuntimeState = {
    progression: {
      currentStage: {
        id: game.initialStage.id,
        kind: "automatic",
      },
      lastActingStage: null,
    },
    rng: {
      seed: game.rngSeed ?? 0,
      cursor: 0,
    },
    history: {
      entries: [],
    },
  };

  return runtime;
}

function getCurrentStageDefinition<
  CanonicalGameState extends object,
  FacadeGameState extends object = CanonicalGameState,
>(
  game: GameDefinition<
    CanonicalGameState,
    FacadeGameState,
    CommandDefinitions<CanonicalGameState, FacadeGameState>
  >,
  state: CanonicalState<CanonicalGameState>,
): StageDefinition<FacadeGameState> | undefined {
  return game.stages[state.runtime.progression.currentStage.id] as
    | StageDefinition<FacadeGameState>
    | undefined;
}

function resolveStageNextStages<GameState extends object>(
  stage: StageDefinition<GameState>,
) {
  return stage.nextStages?.() ?? {};
}

function initializeStageMachine<
  CanonicalGameState extends object,
  FacadeGameState extends object = CanonicalGameState,
>(
  state: CanonicalState<CanonicalGameState>,
  game: GameDefinition<
    CanonicalGameState,
    FacadeGameState,
    CommandDefinitions<CanonicalGameState, FacadeGameState>
  >,
  rng: ReturnType<typeof createRNGService>,
): void {
  let currentStage = game.initialStage as
    | StageDefinition<FacadeGameState>
    | undefined;

  while (currentStage) {
    if (currentStage.kind === "activePlayer") {
      state.runtime.progression.currentStage = {
        id: currentStage.id,
        kind: "activePlayer",
        activePlayerId: currentStage.activePlayer({
          game: createCommandGameView(game, state, { readonly: true }),
          runtime: state.runtime,
        }),
      };
      return;
    }

    if (currentStage.kind === "multiActivePlayer") {
      const memory = currentStage.memory();
      state.runtime.progression.currentStage = {
        id: currentStage.id,
        kind: "multiActivePlayer",
        activePlayerIds: currentStage.activePlayers({
          game: createCommandGameView(game, state, { readonly: true }),
          runtime: state.runtime,
          memory,
        }),
        memory,
      };
      return;
    }

    state.runtime.progression.currentStage = {
      id: currentStage.id,
      kind: "automatic",
    };

    currentStage.run?.({
      game: createCommandGameView(game, state),
      runtime: state.runtime,
      rng,
      emitEvent() {},
    });

    if (!currentStage.transition) {
      return;
    }

    currentStage = currentStage.transition({
      game: createCommandGameView(game, state, { readonly: true }),
      runtime: state.runtime,
      nextStages: resolveStageNextStages(currentStage),
    });
  }
}

function advanceStageMachine<
  CanonicalGameState extends object,
  FacadeGameState extends object = CanonicalGameState,
>(
  state: CanonicalState<CanonicalGameState>,
  game: GameDefinition<
    CanonicalGameState,
    FacadeGameState,
    CommandDefinitions<CanonicalGameState, FacadeGameState>
  >,
  nextStage: StageDefinition<FacadeGameState>,
  rng: ReturnType<typeof createRNGService>,
  emitEvent: (event: GameEvent) => void,
): void {
  let currentStage: StageDefinition<FacadeGameState> | undefined = nextStage;

  while (currentStage) {
    if (currentStage.kind === "activePlayer") {
      const stageState: StageState = {
        id: currentStage.id,
        kind: "activePlayer",
        activePlayerId: currentStage.activePlayer({
          game: createCommandGameView(game, state, { readonly: true }),
          runtime: state.runtime,
        }),
      };
      state.runtime.progression.currentStage = stageState;
      emitEvent(createStageEnteredEvent(stageState));
      return;
    }

    if (currentStage.kind === "multiActivePlayer") {
      const memory = currentStage.memory();
      const stageState: StageState = {
        id: currentStage.id,
        kind: "multiActivePlayer",
        activePlayerIds: currentStage.activePlayers({
          game: createCommandGameView(game, state, { readonly: true }),
          runtime: state.runtime,
          memory,
        }),
        memory,
      };
      state.runtime.progression.currentStage = stageState;
      emitEvent(createStageEnteredEvent(stageState));
      return;
    }

    const stageState: StageState = {
      id: currentStage.id,
      kind: "automatic",
    };
    state.runtime.progression.currentStage = stageState;
    emitEvent(createStageEnteredEvent(stageState));

    currentStage.run?.({
      game: createCommandGameView(game, state),
      runtime: state.runtime,
      rng,
      emitEvent,
    });

    if (!currentStage.transition) {
      return;
    }

    emitEvent(createStageExitedEvent(stageState));
    currentStage = currentStage.transition({
      game: createCommandGameView(game, state, { readonly: true }),
      runtime: state.runtime,
      nextStages: resolveStageNextStages(currentStage),
    });
  }
}

export function createGameExecutor<
  CanonicalGameState extends object,
  FacadeGameState extends object = CanonicalGameState,
  Commands extends Record<string, CommandDefinition<FacadeGameState>> = Record<
    string,
    CommandDefinition<FacadeGameState>
  >,
>(
  game: GameDefinition<CanonicalGameState, FacadeGameState, Commands>,
): GameExecutor<CanonicalGameState> {
  return {
    createInitialState(options) {
      const gameState = structuredClone(game.defaultCanonicalGameState);
      const runtime = createInitialRuntimeState(
        game as GameDefinition<
          CanonicalGameState,
          FacadeGameState,
          CommandDefinitions<CanonicalGameState, FacadeGameState>
        >,
      );
      const rng = createRNGService(runtime.rng);

      game.setup?.({
        game: createCommandGameView(
          game as GameDefinition<
            CanonicalGameState,
            FacadeGameState,
            CommandDefinitions<CanonicalGameState, FacadeGameState>
          >,
          {
            game: gameState,
            runtime,
          },
        ),
        runtime,
        rng,
        playerIds: options?.playerIds ?? [],
      });

      initializeStageMachine(
        {
          game: gameState,
          runtime,
        },
        game as GameDefinition<
          CanonicalGameState,
          FacadeGameState,
          CommandDefinitions<CanonicalGameState, FacadeGameState>
        >,
        rng,
      );

      return {
        game: gameState,
        runtime,
      };
    },

    getView(state, viewer) {
      return getVisibleStateView(state, viewer, game.stateFacade);
    },

    listAvailableCommands(state, options) {
      const currentStageState = state.runtime.progression.currentStage;
      const currentStage = getCurrentStageDefinition(
        game as GameDefinition<
          CanonicalGameState,
          FacadeGameState,
          CommandDefinitions<CanonicalGameState, FacadeGameState>
        >,
        state,
      );

      if (!currentStage) {
        return [];
      }

      if (
        currentStage.kind === "activePlayer" &&
        currentStageState.kind === "activePlayer"
      ) {
        if (options.actorId !== currentStageState.activePlayerId) {
          return [];
        }
      } else if (
        currentStage.kind === "multiActivePlayer" &&
        currentStageState.kind === "multiActivePlayer"
      ) {
        if (!currentStageState.activePlayerIds.includes(options.actorId)) {
          return [];
        }
      } else {
        return [];
      }

      return currentStage.commands
        .filter((definition) => {
          if (!definition.isAvailable) {
            return true;
          }

          return definition.isAvailable(
            createCommandAvailabilityContext(
              state,
              createCommandGameView(
                game as GameDefinition<
                  CanonicalGameState,
                  FacadeGameState,
                  CommandDefinitions<CanonicalGameState, FacadeGameState>
                >,
                state,
                { readonly: true },
              ),
              definition.commandId,
              options.actorId,
            ),
          );
        })
        .map((definition) => definition.commandId);
    },

    discoverCommand(state, discovery) {
      const currentStage = getCurrentStageDefinition(
        game as GameDefinition<
          CanonicalGameState,
          FacadeGameState,
          CommandDefinitions<CanonicalGameState, FacadeGameState>
        >,
        state,
      );

      if (
        !currentStage ||
        (currentStage.kind !== "activePlayer" &&
          currentStage.kind !== "multiActivePlayer") ||
        !isActorAllowedInCurrentStage(
          state.runtime.progression.currentStage,
          discovery.actorId,
        ) ||
        !currentStage.commands.some(
          (command) => command.commandId === discovery.type,
        )
      ) {
        return null;
      }

      const definition = game.commands[discovery.type];

      if (!definition?.discover) {
        return null;
      }

      if (
        typeof discovery.actorId !== "string" ||
        discovery.actorId.length === 0
      ) {
        return null;
      }

      if (
        typeof discovery.input !== "object" ||
        discovery.input === null ||
        Array.isArray(discovery.input)
      ) {
        return null;
      }

      if (
        definition.isAvailable &&
        !definition.isAvailable(
          createCommandAvailabilityContext(
            state,
            createCommandGameView(
              game as GameDefinition<
                CanonicalGameState,
                FacadeGameState,
                CommandDefinitions<CanonicalGameState, FacadeGameState>
              >,
              state,
              { readonly: true },
            ),
            discovery.type,
            discovery.actorId,
          ),
        )
      ) {
        return null;
      }

      return definition.discover(
        createDiscoveryContext(
          state,
          createCommandGameView(
            game as GameDefinition<
              CanonicalGameState,
              FacadeGameState,
              CommandDefinitions<CanonicalGameState, FacadeGameState>
            >,
            state,
            { readonly: true },
          ),
          discovery,
        ),
      );
    },

    executeCommand(state, command) {
      const definition = game.commands[command.type];

      if (!definition) {
        const failure: ExecutionFailure<CanonicalState<CanonicalGameState>> = {
          ok: false,
          state,
          reason: "unknown_command",
          metadata: { commandType: command.type },
          events: [],
        };

        return failure;
      }

      if (typeof command.actorId !== "string" || command.actorId.length === 0) {
        const failure: ExecutionFailure<CanonicalState<CanonicalGameState>> = {
          ok: false,
          state,
          reason: "missing_actor_id",
          metadata: { commandType: command.type },
          events: [],
        };

        return failure;
      }

      if (
        typeof command.input !== "object" ||
        command.input === null ||
        Array.isArray(command.input)
      ) {
        const failure: ExecutionFailure<CanonicalState<CanonicalGameState>> = {
          ok: false,
          state,
          reason: "missing_command_input",
          metadata: { commandType: command.type },
          events: [],
        };

        return failure;
      }

      const currentStageState = state.runtime.progression.currentStage;
      const currentStage = getCurrentStageDefinition(
        game as GameDefinition<
          CanonicalGameState,
          FacadeGameState,
          CommandDefinitions<CanonicalGameState, FacadeGameState>
        >,
        state,
      );

      if (
        !currentStage ||
        (currentStage.kind !== "activePlayer" &&
          currentStage.kind !== "multiActivePlayer")
      ) {
        return {
          ok: false,
          state,
          reason: "stage_not_accepting_commands",
          metadata: { stageId: state.runtime.progression.currentStage.id },
          events: [],
        } as ExecutionFailure<CanonicalState<CanonicalGameState>>;
      }

      if (!isActorAllowedInCurrentStage(currentStageState, command.actorId)) {
        return {
          ok: false,
          state,
          reason: "not_active_player",
          metadata: {
            stageId: currentStage.id,
            activePlayerId:
              currentStageState.kind === "activePlayer"
                ? currentStageState.activePlayerId
                : null,
            activePlayerIds:
              currentStageState.kind === "multiActivePlayer"
                ? currentStageState.activePlayerIds
                : null,
          },
          events: [],
        } as ExecutionFailure<CanonicalState<CanonicalGameState>>;
      }

      if (
        !currentStage.commands.some(
          (candidate) => candidate.commandId === command.type,
        )
      ) {
        return {
          ok: false,
          state,
          reason: "command_not_allowed_in_stage",
          metadata: {
            stageId: currentStage.id,
            commandType: command.type,
          },
          events: [],
        } as ExecutionFailure<CanonicalState<CanonicalGameState>>;
      }

      const validation = definition.validate(
        createValidationContext(
          state,
          createCommandGameView(
            game as GameDefinition<
              CanonicalGameState,
              FacadeGameState,
              CommandDefinitions<CanonicalGameState, FacadeGameState>
            >,
            state,
            { readonly: true },
          ),
          command,
        ),
      );

      if (!validation.ok) {
        const failure: ExecutionFailure<CanonicalState<CanonicalGameState>> = {
          ok: false,
          state,
          reason: validation.reason,
          metadata: validation.metadata,
          events: [],
        };

        return failure;
      }

      const workingState = cloneCanonicalState(state);
      const collector = createEventCollector();
      const rng = createRNGService(workingState.runtime.rng);

      if (
        currentStage.kind === "activePlayer" &&
        currentStageState.kind === "activePlayer"
      ) {
        executeCommandAgainstState(
          workingState,
          game as GameDefinition<
            CanonicalGameState,
            FacadeGameState,
            CommandDefinitions<CanonicalGameState, FacadeGameState>
          >,
          definition,
          command,
          rng,
          collector.emit,
        );
        workingState.runtime.progression.lastActingStage = {
          id: currentStageState.id,
          kind: "activePlayer",
          activePlayerId: currentStageState.activePlayerId,
        } satisfies SingleActivePlayerStageState;

        const nextCurrentStage = getCurrentStageDefinition(
          game as GameDefinition<
            CanonicalGameState,
            FacadeGameState,
            CommandDefinitions<CanonicalGameState, FacadeGameState>
          >,
          workingState,
        );

        if (!nextCurrentStage || nextCurrentStage.kind !== "activePlayer") {
          throw new Error(
            "active_player_stage_required_after_command_execution",
          );
        }

        collector.emit(
          createStageExitedEvent(workingState.runtime.progression.currentStage),
        );

        advanceStageMachine(
          workingState,
          game as GameDefinition<
            CanonicalGameState,
            FacadeGameState,
            CommandDefinitions<CanonicalGameState, FacadeGameState>
          >,
          nextCurrentStage.transition({
            game: createCommandGameView(
              game as GameDefinition<
                CanonicalGameState,
                FacadeGameState,
                CommandDefinitions<CanonicalGameState, FacadeGameState>
              >,
              workingState,
              { readonly: true },
            ),
            runtime: workingState.runtime,
            command: command as Parameters<
              typeof nextCurrentStage.transition
            >[0]["command"],
            nextStages: resolveStageNextStages(nextCurrentStage),
          }),
          rng,
          collector.emit,
        );
      } else if (
        currentStage.kind === "multiActivePlayer" &&
        currentStageState.kind === "multiActivePlayer"
      ) {
        const memory = (
          workingState.runtime.progression
            .currentStage as MultiActivePlayerStageState<object>
        ).memory;

        currentStage.onSubmit({
          game: createCommandGameView(
            game as GameDefinition<
              CanonicalGameState,
              FacadeGameState,
              CommandDefinitions<CanonicalGameState, FacadeGameState>
            >,
            workingState,
            { readonly: true },
          ),
          runtime: workingState.runtime,
          memory,
          command: command as Parameters<
            typeof currentStage.onSubmit
          >[0]["command"],
          execute: (submittedCommand) => {
            const submittedDefinition = game.commands[submittedCommand.type];

            if (!submittedDefinition) {
              throw new Error(
                `unknown_command_in_multi_active_execute:${submittedCommand.type}`,
              );
            }

            executeCommandAgainstState(
              workingState,
              game as GameDefinition<
                CanonicalGameState,
                FacadeGameState,
                CommandDefinitions<CanonicalGameState, FacadeGameState>
              >,
              submittedDefinition,
              submittedCommand,
              rng,
              collector.emit,
            );
          },
        });

        const nextActivePlayerIds = currentStage.activePlayers({
          game: createCommandGameView(
            game as GameDefinition<
              CanonicalGameState,
              FacadeGameState,
              CommandDefinitions<CanonicalGameState, FacadeGameState>
            >,
            workingState,
            { readonly: true },
          ),
          runtime: workingState.runtime,
          memory,
        });

        workingState.runtime.progression.currentStage = {
          id: currentStage.id,
          kind: "multiActivePlayer",
          activePlayerIds: nextActivePlayerIds,
          memory,
        } satisfies MultiActivePlayerStageState;

        if (
          currentStage.isComplete({
            game: createCommandGameView(
              game as GameDefinition<
                CanonicalGameState,
                FacadeGameState,
                CommandDefinitions<CanonicalGameState, FacadeGameState>
              >,
              workingState,
              { readonly: true },
            ),
            runtime: workingState.runtime,
            memory,
          })
        ) {
          workingState.runtime.progression.lastActingStage = {
            id: currentStage.id,
            kind: "multiActivePlayer",
            activePlayerIds: nextActivePlayerIds,
            memory,
          } satisfies MultiActivePlayerStageState<object>;

          collector.emit(
            createStageExitedEvent(
              workingState.runtime.progression.currentStage,
            ),
          );

          advanceStageMachine(
            workingState,
            game as GameDefinition<
              CanonicalGameState,
              FacadeGameState,
              CommandDefinitions<CanonicalGameState, FacadeGameState>
            >,
            currentStage.transition({
              game: createCommandGameView(
                game as GameDefinition<
                  CanonicalGameState,
                  FacadeGameState,
                  CommandDefinitions<CanonicalGameState, FacadeGameState>
                >,
                workingState,
                { readonly: true },
              ),
              runtime: workingState.runtime,
              memory,
              nextStages: resolveStageNextStages(currentStage),
            }),
            rng,
            collector.emit,
          );
        }
      }

      const success: ExecutionSuccess<CanonicalState<CanonicalGameState>> = {
        ok: true,
        state: workingState,
        events: collector.list(),
      };

      return success;
    },
  };
}

function isActorAllowedInCurrentStage(
  currentStageState: StageState,
  actorId: string,
): boolean {
  if (currentStageState.kind === "activePlayer") {
    return actorId === currentStageState.activePlayerId;
  }

  if (currentStageState.kind === "multiActivePlayer") {
    return currentStageState.activePlayerIds.includes(actorId);
  }

  return false;
}

function executeCommandAgainstState<
  CanonicalGameState extends object,
  FacadeGameState extends object = CanonicalGameState,
>(
  state: CanonicalState<CanonicalGameState>,
  game: GameDefinition<
    CanonicalGameState,
    FacadeGameState,
    CommandDefinitions<CanonicalGameState, FacadeGameState>
  >,
  definition: InternalCommandDefinition<
    CanonicalGameState,
    FacadeGameState,
    RuntimeState
  >,
  command: Command,
  rng: ReturnType<typeof createRNGService>,
  emitEvent: (event: GameEvent) => void,
): void {
  definition.execute(
    createExecuteContext(
      state,
      createCommandGameView(game, state),
      command,
      rng,
      emitEvent,
    ),
  );

  state.runtime.history.entries.push({
    id: String(state.runtime.history.entries.length + 1),
    commandType: command.type,
    actorId: command.actorId,
  });
}
