import type { AnyGameExecutor, SetupInputOf } from "../client/game-shape.ts";
import type { TableverseClient } from "../client/types.ts";
import { createTableverseClient } from "../client/client-core.ts";
import { DevTransport } from "./dev-transport.ts";

export interface CreateDevClientOptions<E extends AnyGameExecutor> {
  viewer?: string;
  setupInput?: SetupInputOf<E>;
}

export function createDevClient<E extends AnyGameExecutor>(
  baseUrl: string,
  options: CreateDevClientOptions<E> = {},
): TableverseClient<E> {
  const transport = new DevTransport<E>(baseUrl, {
    viewer: options.viewer ?? "p1",
    setupInput: options.setupInput,
  });
  return createTableverseClient(transport);
}
