import type {
  AnyGameExecutor,
  GameShapeOf,
} from "../../src/client/game-shape.ts";
import type { ExecutionResult } from "../../src/client/types.ts";
import type { TransportErrorReason } from "../../src/client/lifecycle.ts";
import type {
  Transport,
  TransportHandlers,
  TransportSnapshot,
} from "../../src/client/transport.ts";

export interface FakeTransportOptions<E extends AnyGameExecutor> {
  executeResult?: ExecutionResult;
  discoverResult: GameShapeOf<E>["discovery"]["result"];
  availableCommands?: readonly string[];
}

export class FakeTransport<E extends AnyGameExecutor> implements Transport<E> {
  closed = false;
  executeCalls = 0;
  discoverCalls = 0;
  listCalls = 0;

  #handlers: TransportHandlers<E> | null = null;
  readonly #executeResult: ExecutionResult;
  readonly #discoverResult: GameShapeOf<E>["discovery"]["result"];
  readonly #availableCommands: readonly string[];

  constructor(options: FakeTransportOptions<E>) {
    this.#executeResult = options.executeResult ?? { accepted: true };
    this.#discoverResult = options.discoverResult;
    this.#availableCommands = options.availableCommands ?? [];
  }

  connect(handlers: TransportHandlers<E>): void {
    this.#handlers = handlers;
  }

  execute(): Promise<ExecutionResult> {
    this.executeCalls += 1;
    return Promise.resolve(this.#executeResult);
  }

  discover(): Promise<GameShapeOf<E>["discovery"]["result"]> {
    this.discoverCalls += 1;
    return Promise.resolve(this.#discoverResult);
  }

  listAvailableCommands(): Promise<readonly string[]> {
    this.listCalls += 1;
    return Promise.resolve(this.#availableCommands);
  }

  close(): void {
    this.closed = true;
  }

  emitSnapshot(snapshot: TransportSnapshot<E>): void {
    this.#handlers?.onSnapshot(snapshot);
  }

  emitEvent(event: GameShapeOf<E>["event"]): void {
    this.#handlers?.onEvent(event);
  }

  reconnecting(): void {
    this.#handlers?.onReconnecting();
  }

  serverClosed(): void {
    this.#handlers?.onClosed();
  }

  fail(reason: TransportErrorReason = "connection_lost"): void {
    this.#handlers?.onError(reason);
  }
}
