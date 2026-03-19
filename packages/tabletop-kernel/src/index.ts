export { defineGame } from "./game-definition";
export { createKernel } from "./kernel/create-kernel";
export { appendReplayStep, createReplayRecord, replayRecord } from "./replay/history";
export { createSnapshot, restoreSnapshot } from "./snapshot/snapshot";

export type { GameDefinition, GameDefinitionInput } from "./game-definition";
export type {
  Command,
  CommandDefinition,
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
  ProgressionDefinition,
  ProgressionSegmentDefinition,
  ProgressionSegmentState,
  ProgressionState,
} from "./types/progression";
export type { RNGApi, RNGState } from "./types/rng";
export type { ReplayRecord, Snapshot } from "./types/snapshot";
