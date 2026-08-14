import type {
  AnyGameExecutor,
  GameShapeOf,
} from "../../src/client/game-shape.ts";
import type {
  ExecutionResult,
  TableverseClient,
} from "../../src/client/types.ts";
import type {
  ConnectionStatus,
  TransportErrorReason,
} from "../../src/client/lifecycle.ts";
import { TransportError } from "../../src/client/lifecycle.ts";

export interface ReferenceClientOptions<E extends AnyGameExecutor> {
  viewerId: string;
  view: GameShapeOf<E>["view"];
  version?: number;
  executeResult?: ExecutionResult;
  discoverResult: GameShapeOf<E>["discovery"]["result"];
}

interface ReadyWaiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

export class ReferenceClient<
  E extends AnyGameExecutor,
> implements TableverseClient<E> {
  #status: ConnectionStatus = "connecting";
  #errorReason: TransportErrorReason = "connection_lost";
  #viewerId: string | null = null;
  #view: GameShapeOf<E>["view"] | null = null;
  #version: number | null = null;

  readonly #targetViewerId: string;
  readonly #targetView: GameShapeOf<E>["view"];
  readonly #targetVersion: number;
  readonly #executeResult: ExecutionResult;
  readonly #discoverResult: GameShapeOf<E>["discovery"]["result"];

  readonly #snapshotListeners = new Set<() => void>();
  readonly #eventListeners = new Set<
    (event: GameShapeOf<E>["event"]) => void
  >();
  readonly #readyWaiters: ReadyWaiter[] = [];

  constructor(options: ReferenceClientOptions<E>) {
    this.#targetViewerId = options.viewerId;
    this.#targetView = options.view;
    this.#targetVersion = options.version ?? 1;
    this.#executeResult = options.executeResult ?? { accepted: true };
    this.#discoverResult = options.discoverResult;
    queueMicrotask(() => this.#becomeReady());
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
    return Promise.resolve([]);
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

  discover(): Promise<GameShapeOf<E>["discovery"]["result"]> {
    if (this.#status !== "ready") {
      return Promise.reject(new TransportError("not_ready"));
    }
    return Promise.resolve(this.#discoverResult);
  }

  execute(): Promise<ExecutionResult> {
    if (this.#status !== "ready") {
      return Promise.reject(new TransportError("not_ready"));
    }
    return Promise.resolve(this.#executeResult);
  }

  dispose(): void {
    if (this.#status === "closed") {
      return;
    }
    this.#status = "closed";
    this.#notifySnapshot();
    this.#rejectWaiters(new TransportError("closed"));
    this.#snapshotListeners.clear();
    this.#eventListeners.clear();
  }

  fail(reason: TransportErrorReason = "connection_lost"): void {
    if (this.#status === "closed" || this.#status === "error") {
      return;
    }
    this.#status = "error";
    this.#errorReason = reason;
    this.#notifySnapshot();
    this.#rejectWaiters(new TransportError(reason));
  }

  emit(event: GameShapeOf<E>["event"]): void {
    for (const listener of [...this.#eventListeners]) {
      listener(event);
    }
  }

  #becomeReady(): void {
    if (this.#status !== "connecting") {
      return;
    }
    this.#status = "ready";
    this.#viewerId = this.#targetViewerId;
    this.#view = this.#targetView;
    this.#version = this.#targetVersion;
    this.#notifySnapshot();
    const waiters = this.#readyWaiters.splice(0);
    for (const waiter of waiters) {
      waiter.resolve();
    }
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
