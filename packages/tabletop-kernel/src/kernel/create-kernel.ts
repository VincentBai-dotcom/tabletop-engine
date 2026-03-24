import type { GameDefinition } from "../game-definition";
import { createExecuteContext, createValidationContext } from "./contexts";
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
import type { Command, CommandDefinition } from "../types/command";
import type {
  ExecutionFailure,
  ExecutionResult,
  ExecutionSuccess,
} from "../types/result";
import type { CanonicalState, RuntimeState } from "../types/state";
import { createRNGService } from "../rng/service";

type CommandDefinitions<GameState extends object> = Record<
  string,
  CommandDefinition<GameState, RuntimeState, Command>
>;

export interface Kernel<GameState extends object> {
  createInitialState(options?: {
    playerIds?: readonly string[];
  }): CanonicalState<GameState>;
  executeCommand(
    state: CanonicalState<GameState>,
    command: Command,
  ): ExecutionResult<CanonicalState<GameState>>;
}

function createInitialRuntimeState<GameState extends object>(
  progression: NormalizedProgressionDefinition<
    GameState,
    RuntimeState,
    Command
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

export function createKernel<
  GameState extends object,
  Commands extends CommandDefinitions<GameState>,
>(game: GameDefinition<GameState, Commands>): Kernel<GameState> {
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

    executeCommand(state, command) {
      const definition = game.commands[command.type];

      if (!definition) {
        const failure: ExecutionFailure<CanonicalState<GameState>> = {
          ok: false,
          state,
          reason: "unknown_command",
          metadata: { commandType: command.type },
          events: [],
          pendingChoices: state.runtime.pending.choices,
        };

        return failure;
      }

      const validation = definition.validate(
        createValidationContext(state, command),
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
          command,
          rng,
          setCurrentSegmentOwner,
          collector.emit,
        ),
      );

      resolveProgressionLifecycle(
        workingState,
        command,
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
