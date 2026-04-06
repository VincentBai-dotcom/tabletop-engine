export { GameDefinitionBuilder } from "./game-definition";
export { createCommandFactory } from "./command-factory";
export { createStageFactory } from "./stage-factory";
export { createGameExecutor } from "./runtime/game-executor";
export { generateAsyncApi } from "./protocol/asyncapi";
export { describeGameProtocol } from "./protocol/describe";
export { t } from "./schema";
export {
  field,
  getStateMetadata,
  hidden,
  OwnedByPlayer,
  State,
  viewSchema,
  visibleToSelf,
} from "./state-facade/metadata";
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
export type { GameExecutor } from "./runtime/game-executor";
export type {
  AsyncApiChannelNames,
  AsyncApiDocument,
  AsyncApiOptions,
} from "./protocol/asyncapi";
export type {
  GameProtocolDescriptor,
  ProtocolCommandDescriptor,
} from "./protocol/describe";
export type {
  ArrayFieldType,
  FieldType,
  NumberFieldType,
  ObjectFieldType,
  OptionalFieldType,
  RecordFieldType,
  SerializableSchema,
  StateFieldMetadata,
  StringFieldType,
} from "./schema";
export type {
  CommandAvailabilityContext,
  CommandDefinition,
  CommandSchema,
  CommandDiscoveryResult,
  Command,
  Discovery,
  DiscoveryOption,
  CommandFromSchema,
  DiscoveryContext,
  DefinedCommand,
  ExecuteContext,
  ValidationContext,
} from "./types/command";
export type { CommandFactory } from "./command-factory";
export type {
  AutomaticStageBuilder,
  SingleActivePlayerStageBuilder,
  StageFactory,
} from "./stage-factory";
export type { GameEvent } from "./types/event";
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
  RuntimeState,
} from "./types/state";
export type {
  HiddenValue,
  PlayerViewer,
  SpectatorViewer,
  Viewer,
  VisibleState,
} from "./types/visibility";
export type {
  AutomaticStageDefinition,
  AutomaticStageState,
  ProgressionState,
  SingleActivePlayerSelectionContext,
  SingleActivePlayerStageState,
  SingleActivePlayerStageDefinition,
  SingleActivePlayerTransitionContext,
  StageState,
  StageDefinition,
  StageDefinitionMap,
} from "./types/progression";
export type { RNGApi, RNGState } from "./types/rng";
export type { ReplayRecord, Snapshot } from "./types/snapshot";
