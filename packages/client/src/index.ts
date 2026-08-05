// Framework-neutral core. Safe to import from a canvas/WebGL/WASM frontend.
export type { AnyGameExecutor, GameShapeOf } from "./client/game-shape.ts";
export type {
  DiscoveryResult,
  ExecutionResult,
  TableverseClient,
} from "./client/types.ts";

export {
  createInProcessClient,
  type CreateInProcessClientOptions,
  type InProcessClient,
} from "./adapters/in-process.ts";
