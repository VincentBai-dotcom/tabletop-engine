import type { CommandInput } from "./command";
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

export interface InternalProgressionCompletionContext<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> {
  state: Readonly<ProgressionExecutionState<CanonicalGameState, Runtime>>;
  game: Readonly<FacadeGameState>;
  runtime: Readonly<Runtime>;
  commandInput: TCommandInput;
  segment: Readonly<ProgressionSegmentState>;
  progression: ProgressionNavigation;
}

export interface ProgressionCompletionContext<
  FacadeGameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> {
  game: Readonly<FacadeGameState>;
  runtime: Readonly<Runtime>;
  commandInput: TCommandInput;
  segment: Readonly<ProgressionSegmentState>;
  progression: ProgressionNavigation;
}

export interface InternalProgressionLifecycleHookContext<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> extends InternalProgressionCompletionContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TCommandInput
> {
  game: FacadeGameState;
  rng: RNGApi;
  emitEvent(event: KernelEvent): void;
}

export interface ProgressionLifecycleHookContext<
  FacadeGameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> extends ProgressionCompletionContext<
  FacadeGameState,
  Runtime,
  TCommandInput
> {
  game: FacadeGameState;
  rng: RNGApi;
  emitEvent(event: KernelEvent): void;
}

export type ProgressionCompletionCallback<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> = (
  context: ProgressionCompletionContext<GameState, Runtime, TCommandInput>,
) => boolean;

export type ProgressionCompletionPolicy<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> =
  | BuiltInProgressionCompletionPolicy
  | ProgressionCompletionCallback<GameState, Runtime, TCommandInput>;

export interface ProgressionResolveNextResult {
  nextSegmentId?: string | null;
  ownerId?: string;
}

export type ProgressionResolveNext<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> = (
  context: ProgressionLifecycleHookContext<GameState, Runtime, TCommandInput>,
) => ProgressionResolveNextResult | void;

export type ProgressionLifecycleHook<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> = (
  context: ProgressionLifecycleHookContext<GameState, Runtime, TCommandInput>,
) => void;

export interface ProgressionSegmentDefinition<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> {
  id: string;
  children: ProgressionSegmentDefinition<GameState, Runtime, TCommandInput>[];
  kind?: string;
  completionPolicy?: ProgressionCompletionPolicy<
    GameState,
    Runtime,
    TCommandInput
  >;
  onEnter?: ProgressionLifecycleHook<GameState, Runtime, TCommandInput>;
  onExit?: ProgressionLifecycleHook<GameState, Runtime, TCommandInput>;
  resolveNext?: ProgressionResolveNext<GameState, Runtime, TCommandInput>;
}

export interface ProgressionDefinition<
  GameState extends object = object,
  Runtime = unknown,
  TCommandInput extends CommandInput = CommandInput,
> {
  root: ProgressionSegmentDefinition<GameState, Runtime, TCommandInput>;
}
