import type {
  CommandAvailabilityContext,
  Command,
  DiscoveryContext,
  ExecuteContext,
  ValidationContext,
} from "../types/command";
import type { KernelEvent } from "../types/event";
import type { CanonicalState, RuntimeState } from "../types/state";
import type { RNGApi } from "../types/rng";
import type {
  ProgressionCompletionContext,
  ProgressionLifecycleHookContext,
  ProgressionNavigation,
  ProgressionSegmentState,
  ProgressionState,
} from "../types/progression";

export function createValidationContext<
  GameState extends object,
  Runtime extends RuntimeState,
  Cmd extends Command,
>(
  state: CanonicalState<GameState, Runtime>,
  commandInput: Cmd,
): ValidationContext<GameState, Runtime, Cmd> {
  return {
    state,
    commandInput,
  };
}

export function createCommandAvailabilityContext<
  GameState extends object,
  Runtime extends RuntimeState,
>(
  state: CanonicalState<GameState, Runtime>,
  commandType: string,
  actorId?: string,
): CommandAvailabilityContext<GameState, Runtime> {
  return {
    state,
    commandType,
    actorId,
  };
}

export function createDiscoveryContext<
  GameState extends object,
  Runtime extends RuntimeState,
  PartialCmd extends Command,
>(
  state: CanonicalState<GameState, Runtime>,
  partialCommand: PartialCmd,
): DiscoveryContext<GameState, Runtime, PartialCmd> {
  return {
    ...createCommandAvailabilityContext(
      state,
      partialCommand.type,
      partialCommand.actorId,
    ),
    partialCommand,
  };
}

export function createExecuteContext<
  GameState extends object,
  Runtime extends RuntimeState,
  Cmd extends Command,
>(
  state: CanonicalState<GameState, Runtime>,
  commandInput: Cmd,
  rng: RNGApi,
  setCurrentSegmentOwner: (ownerId?: string) => void,
  emitEvent: (event: KernelEvent) => void,
): ExecuteContext<GameState, Runtime, Cmd> {
  return {
    state,
    commandInput,
    game: state.game,
    runtime: state.runtime,
    rng,
    setCurrentSegmentOwner,
    emitEvent,
  };
}

export function createProgressionCompletionContext<
  GameState extends object,
  Runtime extends RuntimeState,
  Cmd extends Command,
>(
  state: CanonicalState<GameState, Runtime>,
  commandInput: Cmd,
  segment: ProgressionSegmentState,
): ProgressionCompletionContext<GameState, Runtime, Cmd> {
  return {
    state,
    game: state.game,
    runtime: state.runtime,
    commandInput,
    segment,
    progression: createProgressionNavigation(state.runtime.progression),
  };
}

export function createProgressionLifecycleHookContext<
  GameState extends object,
  Runtime extends RuntimeState,
  Cmd extends Command,
>(
  state: CanonicalState<GameState, Runtime>,
  commandInput: Cmd,
  segment: ProgressionSegmentState,
  rng: RNGApi,
  emitEvent: (event: KernelEvent) => void,
): ProgressionLifecycleHookContext<GameState, Runtime, Cmd> {
  return {
    ...createProgressionCompletionContext(state, commandInput, segment),
    game: state.game,
    rng,
    emitEvent,
  };
}

function createProgressionNavigation(
  progression: ProgressionState,
): ProgressionNavigation {
  return {
    byId(segmentId) {
      return progression.segments[segmentId];
    },
    current() {
      if (!progression.current) {
        return undefined;
      }

      return progression.segments[progression.current];
    },
    parent(segmentId) {
      const targetSegment =
        (segmentId ? progression.segments[segmentId] : undefined) ??
        (progression.current
          ? progression.segments[progression.current]
          : undefined);

      if (!targetSegment?.parentId) {
        return undefined;
      }

      return progression.segments[targetSegment.parentId];
    },
    activePath() {
      const currentSegment = progression.current
        ? progression.segments[progression.current]
        : undefined;

      if (!currentSegment) {
        return [];
      }

      const path: ProgressionSegmentState[] = [];
      let segment: ProgressionSegmentState | undefined = currentSegment;

      while (segment) {
        path.unshift(segment);
        segment = segment.parentId
          ? progression.segments[segment.parentId]
          : undefined;
      }

      return path;
    },
  };
}
