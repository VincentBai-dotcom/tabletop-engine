import type { AnyGameExecutor } from "../client/game-shape.ts";
import type { TableverseClient } from "../client/types.ts";
import { createTableverseClient } from "../client/client-core.ts";
import {
  BridgeTransport,
  type BridgeTransportOptions,
} from "./bridge-transport.ts";

export function createBridgeClient<E extends AnyGameExecutor>(
  options?: BridgeTransportOptions,
): TableverseClient<E> {
  return createTableverseClient(new BridgeTransport<E>(options));
}
