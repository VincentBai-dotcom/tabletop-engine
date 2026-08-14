// Framework-neutral core. Safe to import from a canvas/WebGL/WASM frontend.
export type { AnyGameExecutor, GameShapeOf } from "./client/game-shape.ts";
export type {
  DiscoveryResult,
  ExecutionResult,
  TableverseClient,
} from "./client/types.ts";
export type {
  ConnectionStatus,
  TransportErrorReason,
} from "./client/lifecycle.ts";
export { TransportError } from "./client/lifecycle.ts";
