import type {
  Command,
  Discovery,
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
  TCommandInput extends Command,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: Readonly<FacadeGameState>,
  command: TCommandInput,
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
    command,
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
  TDiscoveryInput extends Record<string, unknown>,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: Readonly<FacadeGameState>,
  discovery: Discovery<TDiscoveryInput>,
): InternalDiscoveryContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TDiscoveryInput
> {
  return {
    ...createCommandAvailabilityContext(
      state,
      game,
      discovery.type,
      discovery.actorId,
    ),
    discovery,
  };
}

export function createExecuteContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TCommandInput extends Command,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: FacadeGameState,
  command: TCommandInput,
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
    command,
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
  TCommandInput extends Command,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: Readonly<FacadeGameState>,
  command: TCommandInput,
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
    command,
    segment,
    progression: createProgressionNavigation(state.runtime.progression),
  };
}

export function createProgressionLifecycleHookContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TCommandInput extends Command,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: FacadeGameState,
  command: TCommandInput,
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
    ...createProgressionCompletionContext(state, game, command, segment),
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
