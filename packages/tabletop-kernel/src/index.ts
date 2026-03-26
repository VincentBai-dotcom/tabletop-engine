export { GameDefinitionBuilder } from "./game-definition";
export { createKernel } from "./kernel/create-kernel";
export {
  appendReplayStep,
  createReplayRecord,
  replayRecord,
} from "./replay/history";
export { createSnapshot, restoreSnapshot } from "./snapshot/snapshot";
export { runScenario } from "./testing/harness";

export type {
  GameDefinition,
  GameDefinitionInput,
  GameSetupContext,
} from "./game-definition";
export type {
  CommandAvailabilityContext,
  Command,
  CommandDefinition,
  CommandDiscoveryResult,
  DiscoveryContext,
  ExecuteContext,
  ValidationContext,
} from "./types/command";
export type { KernelEvent } from "./types/event";
export type {
  ExecutionFailure,
  ExecutionResult,
  ExecutionSuccess,
  ValidationError,
  ValidationOutcome,
  ValidationResult,
} from "./types/result";
export type {
  CanonicalState,
  HistoryEntry,
  HistoryState,
  PendingChoice,
  PendingState,
  RuntimeState,
} from "./types/state";
export type {
  BuiltInProgressionCompletionPolicy,
  ProgressionCompletionCallback,
  ProgressionCompletionContext,
  ProgressionCompletionPolicy,
  ProgressionDefinition,
  ProgressionLifecycleHook,
  ProgressionLifecycleHookContext,
  ProgressionNavigation,
  ProgressionResolveNext,
  ProgressionResolveNextResult,
  ProgressionSegmentDefinition,
  ProgressionSegmentState,
  ProgressionState,
} from "./types/progression";
export type { RNGApi, RNGState } from "./types/rng";
export type { ReplayRecord, Snapshot } from "./types/snapshot";
