// Framework-neutral core. Safe to import from a canvas/WebGL/WASM frontend.
export type { AnyGameExecutor, GameShapeOf } from "./client/game-shape.ts";
export type {
  CommandPayload,
  DiscoveryPayload,
  DiscoveryResult,
  ExecutionResult,
  TableverseClient,
} from "./client/types.ts";

export {
  createInProcessClient,
  type CreateInProcessClientOptions,
  type InProcessClient,
} from "./adapters/in-process.ts";

// Interaction state machine — framework-neutral. A canvas/WebGL/WASM game drives
// discovery/selection with these directly.
export {
  DiscoveryState,
  type CommandInputOf,
  type DiscoveryStateSnapshot,
  type DiscoveryStatus,
  type OpenSnapshotResult,
  type PickOptionOf,
} from "./client/discovery-state.ts";
export {
  selectable,
  type SelectableResult,
  type SelectableState,
} from "./client/selectable.ts";
