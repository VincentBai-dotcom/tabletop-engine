import type {
  Command,
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
  command: Cmd,
): ValidationContext<GameState, Runtime, Cmd> {
  return {
    state,
    command,
  };
}

export function createExecuteContext<
  GameState extends object,
  Runtime extends RuntimeState,
  Cmd extends Command,
>(
  state: CanonicalState<GameState, Runtime>,
  command: Cmd,
  rng: RNGApi,
  setCurrentSegmentOwner: (ownerId?: string) => void,
  emitEvent: (event: KernelEvent) => void,
): ExecuteContext<GameState, Runtime, Cmd> {
  return {
    state,
    command,
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
  command: Cmd,
  segment: ProgressionSegmentState,
): ProgressionCompletionContext<GameState, Runtime, Cmd> {
  return {
    state,
    game: state.game,
    runtime: state.runtime,
    command,
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
  command: Cmd,
  segment: ProgressionSegmentState,
  rng: RNGApi,
  emitEvent: (event: KernelEvent) => void,
): ProgressionLifecycleHookContext<GameState, Runtime, Cmd> {
  return {
    ...createProgressionCompletionContext(state, command, segment),
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
