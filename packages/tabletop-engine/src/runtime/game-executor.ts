import type { GameDefinition } from "../game-definition";
import {
  createCommandAvailabilityContext,
  createDiscoveryContext,
  createExecuteContext,
  createValidationContext,
} from "./contexts";
import { createEventCollector } from "./events";
import {
  createProgressionState,
  normalizeProgressionDefinition,
} from "./progression-normalize";
import {
  resolveProgressionLifecycle,
  type NormalizedProgressionDefinition,
} from "./progression-lifecycle";
import { cloneCanonicalState } from "./transaction";
import type {
  CommandDefinition,
  Command,
  Discovery,
  InternalCommandDefinition,
} from "../types/command";
import type { CommandDiscoveryResult } from "../types/command";
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
    options?: {
      actorId?: string;
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
  if (!game.stateFacade) {
    return state.game as unknown as FacadeGameState;
  }

  return hydrateStateFacade(game.stateFacade, state.game, {
    readonly: options?.readonly ?? false,
  });
}

function createInitialRuntimeState<
  CanonicalGameState extends object,
  FacadeGameState extends object = CanonicalGameState,
>(
  progression: NormalizedProgressionDefinition<
    FacadeGameState,
    RuntimeState,
    Command
  >,
  game: GameDefinition<
    CanonicalGameState,
    FacadeGameState,
    CommandDefinitions<CanonicalGameState, FacadeGameState>
  >,
): RuntimeState {
  const runtime: RuntimeState = {
    progression: createProgressionState(progression),
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
  const progression = normalizeProgressionDefinition(
    game.progression as GameDefinition<
      CanonicalGameState,
      FacadeGameState,
      Commands
    >["progression"],
  );

  return {
    createInitialState(options) {
      const gameState = game.initialState();
      const runtime = createInitialRuntimeState(
        progression,
        game as GameDefinition<
          CanonicalGameState,
          FacadeGameState,
          CommandDefinitions<CanonicalGameState, FacadeGameState>
        >,
      );
      const rng = createRNGService(runtime.rng);

      game.setup?.({
        game: gameState,
        runtime,
        rng,
        playerIds: options?.playerIds ?? [],
      });

      return {
        game: gameState,
        runtime,
      };
    },

    getView(state, viewer) {
      return getVisibleStateView(state, viewer, game.stateFacade);
    },

    listAvailableCommands(state, options) {
      return Object.entries(game.commands)
        .filter(([commandType, definition]) => {
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
              commandType,
              options?.actorId,
            ),
          );
        })
        .map(([commandType]) => commandType);
    },

    discoverCommand(state, discovery) {
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
      const setCurrentSegmentOwner = (ownerId?: string) => {
        const currentSegmentId = workingState.runtime.progression.current;

        if (!currentSegmentId) {
          return;
        }

        const currentSegment =
          workingState.runtime.progression.segments[currentSegmentId];

        if (currentSegment) {
          currentSegment.ownerId = ownerId;
        }
      };

      definition.execute(
        createExecuteContext(
          workingState,
          createCommandGameView(
            game as GameDefinition<
              CanonicalGameState,
              FacadeGameState,
              CommandDefinitions<CanonicalGameState, FacadeGameState>
            >,
            workingState,
          ),
          command,
          rng,
          setCurrentSegmentOwner,
          collector.emit,
        ),
      );

      resolveProgressionLifecycle(
        workingState,
        createCommandGameView(
          game as GameDefinition<
            CanonicalGameState,
            FacadeGameState,
            CommandDefinitions<CanonicalGameState, FacadeGameState>
          >,
          workingState,
          { readonly: true },
        ),
        createCommandGameView(
          game as GameDefinition<
            CanonicalGameState,
            FacadeGameState,
            CommandDefinitions<CanonicalGameState, FacadeGameState>
          >,
          workingState,
        ),
        command,
        progression,
        rng,
        collector.emit,
      );

      const success: ExecutionSuccess<CanonicalState<CanonicalGameState>> = {
        ok: true,
        state: workingState,
        events: collector.list(),
      };

      return success;
    },
  };
}
