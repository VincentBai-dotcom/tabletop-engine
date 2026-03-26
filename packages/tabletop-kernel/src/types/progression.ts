import type { Command } from "./command";
import type { KernelEvent } from "./event";
import type { RNGApi } from "./rng";

export type BuiltInProgressionCompletionPolicy =
  | "after_successful_command"
  | "manual_only";

export interface ProgressionSegmentState {
  id: string;
  kind?: string;
  parentId?: string;
  childIds: string[];
  active: boolean;
  ownerId?: string;
}

export interface ProgressionState {
  current: string | null;
  rootId: string | null;
  segments: Record<string, ProgressionSegmentState>;
}

export interface ProgressionNavigation {
  byId(segmentId: string): Readonly<ProgressionSegmentState> | undefined;
  current(): Readonly<ProgressionSegmentState> | undefined;
  parent(segmentId?: string): Readonly<ProgressionSegmentState> | undefined;
  activePath(): readonly Readonly<ProgressionSegmentState>[];
}

interface ProgressionExecutionState<
  GameState extends object = object,
  Runtime = unknown,
> {
  game: GameState;
  runtime: Runtime;
}

export interface ProgressionCompletionContext<
  GameState extends object = object,
  Runtime = unknown,
  Cmd extends Command = Command,
> {
  state: Readonly<ProgressionExecutionState<GameState, Runtime>>;
  game: Readonly<GameState>;
  runtime: Readonly<Runtime>;
  commandInput: Cmd;
  segment: Readonly<ProgressionSegmentState>;
  progression: ProgressionNavigation;
}

export interface ProgressionLifecycleHookContext<
  GameState extends object = object,
  Runtime = unknown,
  Cmd extends Command = Command,
> extends ProgressionCompletionContext<GameState, Runtime, Cmd> {
  game: GameState;
  rng: RNGApi;
  emitEvent(event: KernelEvent): void;
}

export type ProgressionCompletionCallback<
  GameState extends object = object,
  Runtime = unknown,
  Cmd extends Command = Command,
> = (context: ProgressionCompletionContext<GameState, Runtime, Cmd>) => boolean;

export type ProgressionCompletionPolicy<
  GameState extends object = object,
  Runtime = unknown,
  Cmd extends Command = Command,
> =
  | BuiltInProgressionCompletionPolicy
  | ProgressionCompletionCallback<GameState, Runtime, Cmd>;

export interface ProgressionResolveNextResult {
  nextSegmentId?: string | null;
  ownerId?: string;
}

export type ProgressionResolveNext<
  GameState extends object = object,
  Runtime = unknown,
  Cmd extends Command = Command,
> = (
  context: ProgressionLifecycleHookContext<GameState, Runtime, Cmd>,
) => ProgressionResolveNextResult | void;

export type ProgressionLifecycleHook<
  GameState extends object = object,
  Runtime = unknown,
  Cmd extends Command = Command,
> = (context: ProgressionLifecycleHookContext<GameState, Runtime, Cmd>) => void;

export interface ProgressionSegmentDefinition<
  GameState extends object = object,
  Runtime = unknown,
  Cmd extends Command = Command,
> {
  id: string;
  children: ProgressionSegmentDefinition<GameState, Runtime, Cmd>[];
  kind?: string;
  completionPolicy?: ProgressionCompletionPolicy<GameState, Runtime, Cmd>;
  onEnter?: ProgressionLifecycleHook<GameState, Runtime, Cmd>;
  onExit?: ProgressionLifecycleHook<GameState, Runtime, Cmd>;
  resolveNext?: ProgressionResolveNext<GameState, Runtime, Cmd>;
}

export interface ProgressionDefinition<
  GameState extends object = object,
  Runtime = unknown,
  Cmd extends Command = Command,
> {
  root: ProgressionSegmentDefinition<GameState, Runtime, Cmd>;
}
