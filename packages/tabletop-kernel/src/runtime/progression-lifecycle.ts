import {
  createProgressionCompletionContext,
  createProgressionLifecycleHookContext,
} from "./contexts";
import { createSegmentEnteredEvent, createSegmentExitedEvent } from "./events";
import {
  getDefaultLeafSegmentId,
  getNormalizedSegmentPathIds,
  type NormalizedProgressionDefinition,
} from "./progression-normalize";
import type { CanonicalState, RuntimeState } from "../types/state";
import type { CommandInput } from "../types/command";
import type {
  BuiltInProgressionCompletionPolicy,
  InternalProgressionCompletionContext,
  ProgressionCompletionPolicy,
} from "../types/progression";
import type { GameEvent } from "../types/event";
import type { RNGApi } from "../types/rng";

export type {
  NormalizedProgressionDefinition,
  NormalizedProgressionSegmentDefinition,
} from "./progression-normalize";

export function evaluateCompletionPolicy<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime,
  TCommandInput extends CommandInput,
>(
  policy:
    | ProgressionCompletionPolicy<FacadeGameState, Runtime, TCommandInput>
    | undefined,
  context: InternalProgressionCompletionContext<
    CanonicalGameState,
    FacadeGameState,
    Runtime,
    TCommandInput
  >,
): boolean {
  if (!policy) {
    return false;
  }

  if (typeof policy === "function") {
    return policy(context);
  }

  return evaluateBuiltInCompletionPolicy(policy, context);
}

export function resolveProgressionLifecycle<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TCommandInput extends CommandInput,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  readonlyGame: Readonly<FacadeGameState>,
  mutableGame: FacadeGameState,
  commandInput: TCommandInput,
  progression: NormalizedProgressionDefinition<
    FacadeGameState,
    Runtime,
    TCommandInput
  >,
  rng: RNGApi,
  emitEvent: (event: GameEvent) => void,
): void {
  let segmentId = state.runtime.progression.current;

  while (segmentId) {
    const segment = state.runtime.progression.segments[segmentId];
    const definition = progression.segments[segmentId];

    if (!segment || !definition) {
      break;
    }

    const completionContext = createProgressionCompletionContext(
      state,
      readonlyGame,
      commandInput,
      segment,
    );

    if (
      !evaluateCompletionPolicy(definition.completionPolicy, completionContext)
    ) {
      break;
    }

    const lifecycleContext = createProgressionLifecycleHookContext(
      state,
      mutableGame,
      commandInput,
      segment,
      rng,
      emitEvent,
    );

    definition.onExit?.(lifecycleContext);
    emitEvent(createSegmentExitedEvent(segment));

    const resolution = definition.resolveNext?.(lifecycleContext);
    const explicitTarget =
      resolution &&
      Object.prototype.hasOwnProperty.call(resolution, "nextSegmentId");
    const nextSegmentId = explicitTarget
      ? resolveExplicitTargetSegmentId(progression, resolution.nextSegmentId)
      : (segment.parentId ?? null);

    const activePathAfterExit = getActivePathIds(
      state.runtime.progression,
    ).slice(0, -1);

    if (resolution?.ownerId !== undefined && nextSegmentId) {
      const targetId =
        resolution.nextSegmentId !== undefined
          ? resolution.nextSegmentId
          : nextSegmentId;

      if (targetId) {
        state.runtime.progression.segments[targetId]!.ownerId =
          resolution.ownerId;
      }
    }

    if (!nextSegmentId) {
      applyActivePath(state.runtime.progression, []);
      break;
    }

    if (!explicitTarget) {
      applyActivePath(state.runtime.progression, activePathAfterExit);
      segmentId = nextSegmentId;
      continue;
    }

    const targetPath = getNormalizedSegmentPathIds(progression, nextSegmentId);
    applyActivePath(state.runtime.progression, targetPath);

    const enteredSegmentIds = getEnteredSegmentIds(
      activePathAfterExit,
      targetPath,
    );

    for (const enteredSegmentId of enteredSegmentIds) {
      const enteredSegment =
        state.runtime.progression.segments[enteredSegmentId];
      const enteredDefinition = progression.segments[enteredSegmentId];

      if (!enteredSegment || !enteredDefinition) {
        continue;
      }

      const enteredContext = createProgressionLifecycleHookContext(
        state,
        mutableGame,
        commandInput,
        enteredSegment,
        rng,
        emitEvent,
      );
      enteredDefinition.onEnter?.(enteredContext);
      emitEvent(createSegmentEnteredEvent(enteredSegment));
    }

    break;
  }
}

function evaluateBuiltInCompletionPolicy<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime,
  TCommandInput extends CommandInput,
>(
  policy: BuiltInProgressionCompletionPolicy,
  context: InternalProgressionCompletionContext<
    CanonicalGameState,
    FacadeGameState,
    Runtime,
    TCommandInput
  >,
): boolean {
  void context;

  switch (policy) {
    case "after_successful_command":
      return true;
    case "manual_only":
      return false;
  }
}

function getActivePathIds(progression: RuntimeState["progression"]): string[] {
  return Object.values(progression.segments)
    .filter((segment) => segment.active)
    .map((segment) => segment.id)
    .sort((leftId, rightId) => {
      const leftDepth = getSegmentDepth(progression, leftId);
      const rightDepth = getSegmentDepth(progression, rightId);
      return leftDepth - rightDepth;
    });
}

function getSegmentDepth(
  progression: RuntimeState["progression"],
  segmentId: string,
): number {
  let depth = 0;
  let currentId: string | undefined = segmentId;

  while (currentId) {
    currentId = progression.segments[currentId]?.parentId;
    if (currentId) {
      depth += 1;
    }
  }

  return depth;
}

function applyActivePath(
  progression: RuntimeState["progression"],
  activePathIds: readonly string[],
): void {
  const activeIds = new Set(activePathIds);

  for (const segment of Object.values(progression.segments)) {
    segment.active = activeIds.has(segment.id);
  }

  progression.current =
    activePathIds.length > 0 ? activePathIds[activePathIds.length - 1]! : null;
}

function resolveExplicitTargetSegmentId<
  FacadeGameState extends object,
  Runtime,
  TCommandInput extends CommandInput,
>(
  progression: NormalizedProgressionDefinition<
    FacadeGameState,
    Runtime,
    TCommandInput
  >,
  segmentId: string | null | undefined,
): string | null {
  if (!segmentId) {
    return null;
  }

  return getDefaultLeafSegmentId(progression, segmentId);
}

function getEnteredSegmentIds(
  previousPath: readonly string[],
  nextPath: readonly string[],
): string[] {
  let prefixIndex = 0;

  while (
    prefixIndex < previousPath.length &&
    prefixIndex < nextPath.length &&
    previousPath[prefixIndex] === nextPath[prefixIndex]
  ) {
    prefixIndex += 1;
  }

  return nextPath.slice(prefixIndex);
}
