import type {
  ProgressionCompletionPolicy,
  ProgressionDefinition,
  ProgressionLifecycleHook,
  ProgressionResolveNext,
  ProgressionSegmentDefinition,
  ProgressionSegmentState,
  ProgressionState,
} from "../types/progression";
import type { CommandInput } from "../types/command";

export interface NormalizedProgressionSegmentDefinition<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> {
  id: string;
  kind?: string;
  parentId?: string;
  childIds: string[];
  completionPolicy?: ProgressionCompletionPolicy<
    GameState,
    Runtime,
    TCommandInput
  >;
  onEnter?: ProgressionLifecycleHook<GameState, Runtime, TCommandInput>;
  onExit?: ProgressionLifecycleHook<GameState, Runtime, TCommandInput>;
  resolveNext?: ProgressionResolveNext<GameState, Runtime, TCommandInput>;
}

export interface NormalizedProgressionDefinition<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> {
  rootId: string | null;
  initialSegmentId: string | null;
  segments: Record<
    string,
    NormalizedProgressionSegmentDefinition<GameState, Runtime, TCommandInput>
  >;
}

export function normalizeProgressionDefinition<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
>(
  progression?: ProgressionDefinition<GameState, Runtime, TCommandInput>,
): NormalizedProgressionDefinition<GameState, Runtime, TCommandInput> {
  if (!progression) {
    return {
      rootId: null,
      initialSegmentId: null,
      segments: {},
    };
  }

  const segments: Record<
    string,
    NormalizedProgressionSegmentDefinition<GameState, Runtime, TCommandInput>
  > = {};

  visitSegment(progression.root, undefined, segments);

  return {
    rootId: progression.root.id,
    initialSegmentId: findInitialSegmentId(progression.root),
    segments,
  };
}

export function createProgressionState<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
>(
  progression: NormalizedProgressionDefinition<
    GameState,
    Runtime,
    TCommandInput
  >,
): ProgressionState {
  const activeIds = new Set(
    progression.initialSegmentId
      ? getSegmentPathIds(progression.segments, progression.initialSegmentId)
      : [],
  );
  const segments: Record<string, ProgressionSegmentState> = {};

  for (const [id, segment] of Object.entries(progression.segments)) {
    segments[id] = {
      id: segment.id,
      kind: segment.kind,
      parentId: segment.parentId,
      childIds: [...segment.childIds],
      active: activeIds.has(id),
    };
  }

  return {
    current: progression.initialSegmentId,
    rootId: progression.rootId,
    segments,
  };
}

export function getNormalizedSegmentPathIds<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
>(
  progression: NormalizedProgressionDefinition<
    GameState,
    Runtime,
    TCommandInput
  >,
  segmentId: string,
): string[] {
  return getSegmentPathIds(progression.segments, segmentId);
}

export function getDefaultLeafSegmentId<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
>(
  progression: NormalizedProgressionDefinition<
    GameState,
    Runtime,
    TCommandInput
  >,
  segmentId: string,
): string {
  let currentId = segmentId;
  let currentSegment = progression.segments[currentId];

  while (currentSegment && currentSegment.childIds.length > 0) {
    currentId = currentSegment.childIds[0]!;
    currentSegment = progression.segments[currentId];
  }

  return currentId;
}

function visitSegment<
  GameState extends object,
  Runtime,
  TCommandInput extends CommandInput,
>(
  segment: ProgressionSegmentDefinition<GameState, Runtime, TCommandInput>,
  parentId: string | undefined,
  result: Record<
    string,
    NormalizedProgressionSegmentDefinition<GameState, Runtime, TCommandInput>
  >,
): void {
  if (result[segment.id]) {
    throw new Error(`duplicate progression segment id: ${segment.id}`);
  }

  result[segment.id] = {
    id: segment.id,
    kind: segment.kind,
    parentId,
    childIds: segment.children.map((child) => child.id),
    completionPolicy: segment.completionPolicy,
    onEnter: segment.onEnter,
    onExit: segment.onExit,
    resolveNext: segment.resolveNext,
  };

  for (const child of segment.children) {
    visitSegment(child, segment.id, result);
  }
}

function findInitialSegmentId<
  GameState extends object,
  Runtime,
  TCommandInput extends CommandInput,
>(
  root: ProgressionSegmentDefinition<GameState, Runtime, TCommandInput>,
): string {
  let current = root;

  while (current.children.length > 0) {
    current = current.children[0]!;
  }

  return current.id;
}

function getSegmentPathIds<
  GameState extends object,
  Runtime,
  TCommandInput extends CommandInput,
>(
  segments: Record<
    string,
    NormalizedProgressionSegmentDefinition<GameState, Runtime, TCommandInput>
  >,
  segmentId: string,
): string[] {
  const path: string[] = [];
  let currentId: string | undefined = segmentId;

  while (currentId) {
    path.unshift(currentId);
    currentId = segments[currentId]?.parentId;
  }

  return path;
}
