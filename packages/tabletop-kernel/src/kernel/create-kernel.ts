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
import type { CommandInput, InternalCommandDefinition } from "../types/command";
import type { CommandDiscoveryResult } from "../types/command";
import type {
  ExecutionFailure,
  ExecutionResult,
  ExecutionSuccess,
} from "../types/result";
import type { CanonicalState, RuntimeState } from "../types/state";
import { createRNGService } from "../rng/service";

type CommandDefinitions<GameState extends object> = Record<
  string,
  InternalCommandDefinition<GameState, RuntimeState, CommandInput>
>;

export interface GameExecutor<GameState extends object> {
  createInitialState(options?: {
    playerIds?: readonly string[];
  }): CanonicalState<GameState>;
  listAvailableCommands(
    state: CanonicalState<GameState>,
    options?: {
      actorId?: string;
    },
  ): string[];
  discoverCommand(
    state: CanonicalState<GameState>,
    partialCommand: CommandInput,
  ): CommandDiscoveryResult | null;
  executeCommand(
    state: CanonicalState<GameState>,
    commandInput: CommandInput,
  ): ExecutionResult<CanonicalState<GameState>>;
}

export type Kernel<GameState extends object> = GameExecutor<GameState>;

function createInitialRuntimeState<GameState extends object>(
  progression: NormalizedProgressionDefinition<
    GameState,
    RuntimeState,
    CommandInput
  >,
  game: GameDefinition<GameState, CommandDefinitions<GameState>>,
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
    pending: {
      choices: [],
    },
  };

  return runtime;
}

export function createGameExecutor<
  GameState extends object,
  Commands extends CommandDefinitions<GameState>,
>(game: GameDefinition<GameState, Commands>): GameExecutor<GameState> {
  const progression = normalizeProgressionDefinition(
    game.progression as GameDefinition<
      GameState,
      CommandDefinitions<GameState>
    >["progression"],
  );

  return {
    createInitialState(options) {
      const gameState = game.initialState();
      const runtime = createInitialRuntimeState(
        progression,
        game as GameDefinition<GameState, CommandDefinitions<GameState>>,
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

    listAvailableCommands(state, options) {
      return Object.entries(game.commands)
        .filter(([commandType, definition]) => {
          if (!definition.isAvailable) {
            return true;
          }

          return definition.isAvailable(
            createCommandAvailabilityContext(
              state,
              commandType,
              options?.actorId,
            ),
          );
        })
        .map(([commandType]) => commandType);
    },

    discoverCommand(state, partialCommand) {
      const definition = game.commands[partialCommand.type];

      if (!definition?.discover) {
        return null;
      }

      if (
        definition.isAvailable &&
        !definition.isAvailable(
          createCommandAvailabilityContext(
            state,
            partialCommand.type,
            partialCommand.actorId,
          ),
        )
      ) {
        return null;
      }

      return definition.discover(createDiscoveryContext(state, partialCommand));
    },

    executeCommand(state, commandInput) {
      const definition = game.commands[commandInput.type];

      if (!definition) {
        const failure: ExecutionFailure<CanonicalState<GameState>> = {
          ok: false,
          state,
          reason: "unknown_command",
          metadata: { commandType: commandInput.type },
          events: [],
          pendingChoices: state.runtime.pending.choices,
        };

        return failure;
      }

      const validation = definition.validate(
        createValidationContext(state, commandInput),
      );

      if (!validation.ok) {
        const failure: ExecutionFailure<CanonicalState<GameState>> = {
          ok: false,
          state,
          reason: validation.reason,
          metadata: validation.metadata,
          events: [],
          pendingChoices: state.runtime.pending.choices,
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
          commandInput,
          rng,
          setCurrentSegmentOwner,
          collector.emit,
        ),
      );

      resolveProgressionLifecycle(
        workingState,
        commandInput,
        progression,
        rng,
        collector.emit,
      );

      const success: ExecutionSuccess<CanonicalState<GameState>> = {
        ok: true,
        state: workingState,
        events: collector.list(),
        pendingChoices: workingState.runtime.pending.choices,
      };

      return success;
    },
  };
}

export const createKernel = createGameExecutor;
