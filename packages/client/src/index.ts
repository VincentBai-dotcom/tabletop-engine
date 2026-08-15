// Browser entry: the framework-neutral core plus the production postMessage
// bridge (which needs `window`). The local-dev client is the `./dev` subpath,
// which a Node context can type-check against.
export type {
  AnyGameExecutor,
  GameShapeOf,
  SetupInputOf,
} from "./client/game-shape.ts";
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
export { createTableverseClient } from "./client/client-core.ts";
export {
  BridgeTransport,
  bridgeMessages,
  type BridgeEndpoint,
  type BridgeTransportOptions,
} from "./bridge/bridge-transport.ts";
export { createBridgeClient } from "./bridge/create-bridge-client.ts";
