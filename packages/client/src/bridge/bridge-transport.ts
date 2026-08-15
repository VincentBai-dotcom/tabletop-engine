import type { AnyGameExecutor, GameShapeOf } from "../client/game-shape.ts";
import type { ExecutionResult } from "../client/types.ts";
import type { Transport, TransportHandlers } from "../client/transport.ts";
import {
  TransportError,
  type TransportErrorReason,
} from "../client/lifecycle.ts";

export const bridgeMessages = {
  ready: "game_ready",
  snapshot: "game_snapshot",
  event: "game_event",
  ended: "game_ended",
  error: "error",
  execute: "game_execute",
  executionResult: "game_execution_result",
  discover: "game_discover",
  discoveryResult: "game_discovery_result",
  listCommands: "game_list_available_commands",
  availableCommands: "game_available_commands",
} as const;

export interface BridgeEndpoint {
  post(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
}

export interface BridgeTransportOptions {
  target?: Window;
  targetOrigin?: string;
  allowedOrigin?: string;
  endpoint?: BridgeEndpoint;
}

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: unknown) => void;
}

export class BridgeTransport<
  E extends AnyGameExecutor,
> implements Transport<E> {
  readonly #endpoint: BridgeEndpoint;
  readonly #pending = new Map<string, PendingRequest>();
  #unsubscribe: (() => void) | null = null;
  #nextId = 0;

  constructor(options: BridgeTransportOptions = {}) {
    this.#endpoint =
      options.endpoint ??
      windowEndpoint(
        options.target ?? window.parent,
        options.targetOrigin ?? "*",
        options.allowedOrigin,
      );
  }

  connect(handlers: TransportHandlers<E>): void {
    this.#unsubscribe = this.#endpoint.subscribe((message) =>
      this.#onMessage(handlers, message),
    );
    this.#endpoint.post({ type: bridgeMessages.ready });
  }

  execute(command: GameShapeOf<E>["command"]): Promise<ExecutionResult> {
    return this.#request(
      bridgeMessages.execute,
      command,
    ) as Promise<ExecutionResult>;
  }

  discover(
    request: GameShapeOf<E>["discovery"]["payload"],
  ): Promise<GameShapeOf<E>["discovery"]["result"]> {
    return this.#request(bridgeMessages.discover, request) as Promise<
      GameShapeOf<E>["discovery"]["result"]
    >;
  }

  listAvailableCommands(): Promise<readonly string[]> {
    return this.#request(bridgeMessages.listCommands, undefined) as Promise<
      readonly string[]
    >;
  }

  close(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    for (const request of pending) {
      request.reject(new TransportError("closed"));
    }
  }

  #request(type: string, payload: unknown): Promise<unknown> {
    const requestId = String(this.#nextId++);
    return new Promise((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject });
      this.#endpoint.post({ type, requestId, payload });
    });
  }

  #onMessage(handlers: TransportHandlers<E>, raw: unknown): void {
    if (!isRecord(raw) || typeof raw.type !== "string") {
      return;
    }
    const { type, requestId, payload, reason } = raw;

    if (typeof requestId === "string") {
      const request = this.#pending.get(requestId);
      if (request) {
        this.#pending.delete(requestId);
        if (type === bridgeMessages.error) {
          request.reject(new TransportError(toReason(reason)));
        } else {
          request.resolve(payload);
        }
      }
      return;
    }

    switch (type) {
      case bridgeMessages.snapshot:
        handlers.onSnapshot(payload as TransportSnapshotPayload<E>);
        return;
      case bridgeMessages.event:
        handlers.onEvent(payload as GameShapeOf<E>["event"]);
        return;
      case bridgeMessages.ended:
        handlers.onClosed();
        return;
      case bridgeMessages.error:
        handlers.onError(toReason(reason));
        return;
    }
  }
}

type TransportSnapshotPayload<E extends AnyGameExecutor> = {
  viewerId: string;
  view: GameShapeOf<E>["view"];
  version: number;
};

const KNOWN_REASONS: readonly TransportErrorReason[] = [
  "not_ready",
  "connection_lost",
  "server_error",
  "closed",
];

function toReason(reason: unknown): TransportErrorReason {
  return typeof reason === "string" &&
    (KNOWN_REASONS as readonly string[]).includes(reason)
    ? (reason as TransportErrorReason)
    : "server_error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function windowEndpoint(
  target: Window,
  targetOrigin: string,
  allowedOrigin?: string,
): BridgeEndpoint {
  return {
    post: (message) => target.postMessage(message, targetOrigin),
    subscribe: (listener) => {
      const handler = (event: MessageEvent) => {
        if (allowedOrigin !== undefined && event.origin !== allowedOrigin) {
          return;
        }
        listener(event.data);
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    },
  };
}
