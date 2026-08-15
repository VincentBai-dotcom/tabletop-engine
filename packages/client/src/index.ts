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
export type {
  Transport,
  TransportHandlers,
  TransportSnapshot,
} from "./client/transport.ts";
export type { SetupInputOf } from "./client/game-shape.ts";
export { createTableverseClient } from "./client/client-core.ts";
export {
  DevTransport,
  type DevTransportOptions,
  type SseConnection,
  type SseFactory,
} from "./dev/dev-transport.ts";
export {
  createDevClient,
  type CreateDevClientOptions,
} from "./dev/create-dev-client.ts";
