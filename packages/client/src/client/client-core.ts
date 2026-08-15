import type { AnyGameExecutor, GameShapeOf } from "./game-shape.ts";
import type { ExecutionResult, TableverseClient } from "./types.ts";
import type { ConnectionStatus, TransportErrorReason } from "./lifecycle.ts";
import { TransportError } from "./lifecycle.ts";
import type {
  Transport,
  TransportHandlers,
  TransportSnapshot,
} from "./transport.ts";

interface ReadyWaiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

class TransportClient<
  E extends AnyGameExecutor,
> implements TableverseClient<E> {
  #status: ConnectionStatus = "connecting";
  #errorReason: TransportErrorReason = "connection_lost";
  #viewerId: string | null = null;
  #view: GameShapeOf<E>["view"] | null = null;
  #version: number | null = null;

  readonly #transport: Transport<E>;
  readonly #snapshotListeners = new Set<() => void>();
  readonly #eventListeners = new Set<
    (event: GameShapeOf<E>["event"]) => void
  >();
  readonly #readyWaiters: ReadyWaiter[] = [];

  constructor(transport: Transport<E>) {
    this.#transport = transport;
    transport.connect(this.#handlers());
  }

  getStatus(): ConnectionStatus {
    return this.#status;
  }

  getViewerId(): string | null {
    return this.#viewerId;
  }

  ready(): Promise<void> {
    switch (this.#status) {
      case "ready":
        return Promise.resolve();
      case "closed":
        return Promise.reject(new TransportError("closed"));
      case "error":
        return Promise.reject(new TransportError(this.#errorReason));
      default:
        return new Promise((resolve, reject) => {
          this.#readyWaiters.push({ resolve, reject });
        });
    }
  }

  getView(): GameShapeOf<E>["view"] | null {
    return this.#view;
  }

  getAvailableCommands(): Promise<readonly string[]> {
    if (this.#status !== "ready") {
      return Promise.reject(new TransportError("not_ready"));
    }
    return this.#transport.listAvailableCommands();
  }

  getStateVersion(): number | null {
    return this.#version;
  }

  subscribe(listener: () => void): () => void {
    this.#snapshotListeners.add(listener);
    return () => {
      this.#snapshotListeners.delete(listener);
    };
  }

  onEvent(listener: (event: GameShapeOf<E>["event"]) => void): () => void {
    this.#eventListeners.add(listener);
    return () => {
      this.#eventListeners.delete(listener);
    };
  }

  discover(
    request: GameShapeOf<E>["discovery"]["payload"],
  ): Promise<GameShapeOf<E>["discovery"]["result"]> {
    if (this.#status !== "ready") {
      return Promise.reject(new TransportError("not_ready"));
    }
    return this.#transport.discover(request);
  }

  execute(command: GameShapeOf<E>["command"]): Promise<ExecutionResult> {
    if (this.#status !== "ready") {
      return Promise.reject(new TransportError("not_ready"));
    }
    return this.#transport.execute(command);
  }

  dispose(): void {
    if (this.#status === "closed") {
      return;
    }
    this.#transport.close();
    this.#closeWith(new TransportError("closed"));
  }

  #handlers(): TransportHandlers<E> {
    return {
      onSnapshot: (snapshot) => this.#applySnapshot(snapshot),
      onEvent: (event) => this.#deliverEvent(event),
      onReconnecting: () => this.#setStatus("reconnecting"),
      onClosed: () => this.#closeWith(new TransportError("closed")),
      onError: (reason) => this.#fail(reason),
    };
  }

  #applySnapshot(snapshot: TransportSnapshot<E>): void {
    this.#viewerId = snapshot.viewerId;
    this.#view = snapshot.view;
    this.#version = snapshot.version;
    if (this.#status !== "ready") {
      this.#status = "ready";
      const waiters = this.#readyWaiters.splice(0);
      for (const waiter of waiters) {
        waiter.resolve();
      }
    }
    this.#notifySnapshot();
  }

  #deliverEvent(event: GameShapeOf<E>["event"]): void {
    for (const listener of [...this.#eventListeners]) {
      listener(event);
    }
  }

  #setStatus(status: ConnectionStatus): void {
    if (this.#status === status) {
      return;
    }
    this.#status = status;
    this.#notifySnapshot();
  }

  #fail(reason: TransportErrorReason): void {
    if (this.#status === "closed" || this.#status === "error") {
      return;
    }
    this.#status = "error";
    this.#errorReason = reason;
    this.#notifySnapshot();
    this.#rejectWaiters(new TransportError(reason));
  }

  #closeWith(error: TransportError): void {
    if (this.#status === "closed") {
      return;
    }
    this.#status = "closed";
    this.#notifySnapshot();
    this.#rejectWaiters(error);
    this.#snapshotListeners.clear();
    this.#eventListeners.clear();
  }

  #rejectWaiters(error: unknown): void {
    const waiters = this.#readyWaiters.splice(0);
    for (const waiter of waiters) {
      waiter.reject(error);
    }
  }

  #notifySnapshot(): void {
    for (const listener of [...this.#snapshotListeners]) {
      listener();
    }
  }
}

export function createTableverseClient<E extends AnyGameExecutor>(
  transport: Transport<E>,
): TableverseClient<E> {
  return new TransportClient(transport);
}
