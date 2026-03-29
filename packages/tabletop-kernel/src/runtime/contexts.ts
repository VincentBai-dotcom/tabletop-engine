import type {
  CommandInput,
  InternalCommandAvailabilityContext,
  InternalDiscoveryContext,
  InternalExecuteContext,
  InternalValidationContext,
} from "../types/command";
import type { GameEvent } from "../types/event";
import type { CanonicalState, RuntimeState } from "../types/state";
import type { RNGApi } from "../types/rng";
import type {
  InternalProgressionCompletionContext,
  InternalProgressionLifecycleHookContext,
  ProgressionNavigation,
  ProgressionSegmentState,
  ProgressionState,
} from "../types/progression";

export function createValidationContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TCommandInput extends CommandInput,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: Readonly<FacadeGameState>,
  commandInput: TCommandInput,
): InternalValidationContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TCommandInput
> {
  return {
    state,
    game,
    runtime: state.runtime,
    commandInput,
  };
}

export function createCommandAvailabilityContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: Readonly<FacadeGameState>,
  commandType: string,
  actorId?: string,
): InternalCommandAvailabilityContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime
> {
  return {
    state,
    game,
    runtime: state.runtime,
    commandType,
    actorId,
  };
}

export function createDiscoveryContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TPartialCommandInput extends CommandInput,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: Readonly<FacadeGameState>,
  partialCommand: TPartialCommandInput,
): InternalDiscoveryContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TPartialCommandInput
> {
  return {
    ...createCommandAvailabilityContext(
      state,
      game,
      partialCommand.type,
      partialCommand.actorId,
    ),
    partialCommand,
  };
}

export function createExecuteContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TCommandInput extends CommandInput,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: FacadeGameState,
  commandInput: TCommandInput,
  rng: RNGApi,
  setCurrentSegmentOwner: (ownerId?: string) => void,
  emitEvent: (event: GameEvent) => void,
): InternalExecuteContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TCommandInput
> {
  return {
    state,
    commandInput,
    game,
    runtime: state.runtime,
    rng,
    setCurrentSegmentOwner,
    emitEvent,
  };
}

export function createProgressionCompletionContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TCommandInput extends CommandInput,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: Readonly<FacadeGameState>,
  commandInput: TCommandInput,
  segment: ProgressionSegmentState,
): InternalProgressionCompletionContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TCommandInput
> {
  return {
    state,
    game,
    runtime: state.runtime,
    commandInput,
    segment,
    progression: createProgressionNavigation(state.runtime.progression),
  };
}

export function createProgressionLifecycleHookContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TCommandInput extends CommandInput,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: FacadeGameState,
  commandInput: TCommandInput,
  segment: ProgressionSegmentState,
  rng: RNGApi,
  emitEvent: (event: GameEvent) => void,
): InternalProgressionLifecycleHookContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TCommandInput
> {
  return {
    ...createProgressionCompletionContext(state, game, commandInput, segment),
    game,
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
