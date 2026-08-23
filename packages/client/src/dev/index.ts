// Node-typecheckable subpath: the dev client + core, without the bridge (which
// needs `window`). The default DevTransport still uses `EventSource` at runtime —
// inject an SseFactory to drive it from Node.
export type {
  AnyGameExecutor,
  GameShapeOf,
  SetupInputOf,
} from "../client/game-shape.ts";
export type {
  DiscoveryResult,
  ExecutionResult,
  TableverseClient,
} from "../client/types.ts";
export type {
  ConnectionStatus,
  TransportErrorReason,
} from "../client/lifecycle.ts";
export { TransportError } from "../client/lifecycle.ts";
export type {
  Transport,
  TransportHandlers,
  TransportSnapshot,
} from "../client/transport.ts";
export { TransportClient } from "../client/client-core.ts";
export {
  DevTransport,
  type DevTransportOptions,
  type SseConnection,
  type SseFactory,
} from "./dev-transport.ts";
