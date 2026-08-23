import type { AnyGameExecutor, SetupInputOf } from "./client/game-shape.ts";
import type { TableverseClient } from "./client/types.ts";
import { TransportClient } from "./client/client-core.ts";
import { BridgeTransport } from "./bridge/bridge-transport.ts";
import { DevTransport } from "./dev/dev-transport.ts";

const DEFAULT_SERVER_URL = "http://localhost:5100";

export interface CreateTableverseClientOptions<E extends AnyGameExecutor> {
  serverUrl?: string;
  viewer?: string;
  setupInput?: SetupInputOf<E>;
  players?: string[];
  seed?: string | number;
}

export function createTableverseClient<E extends AnyGameExecutor>(
  options: CreateTableverseClientOptions<E> = {},
): TableverseClient<E> {
  if (window.parent !== window) {
    return new TransportClient(new BridgeTransport<E>());
  }

  return new TransportClient(
    new DevTransport<E>(options.serverUrl ?? DEFAULT_SERVER_URL, {
      viewer: options.viewer ?? "p1",
      setupInput: options.setupInput,
      players: options.players,
      seed: options.seed,
    }),
  );
}
