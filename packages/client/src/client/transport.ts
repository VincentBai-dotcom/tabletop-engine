import type { AnyGameExecutor, GameShapeOf } from "./game-shape.ts";
import type { ExecutionResult } from "./types.ts";
import type { TransportErrorReason } from "./lifecycle.ts";

export interface TransportSnapshot<E extends AnyGameExecutor> {
  viewerId: string;
  view: GameShapeOf<E>["view"];
  version: number;
}

export interface TransportHandlers<E extends AnyGameExecutor> {
  onSnapshot(snapshot: TransportSnapshot<E>): void;
  onEvent(event: GameShapeOf<E>["event"]): void;
  onReconnecting(): void;
  onClosed(): void;
  onError(reason: TransportErrorReason): void;
}

export interface Transport<E extends AnyGameExecutor> {
  connect(handlers: TransportHandlers<E>): void;
  execute(command: GameShapeOf<E>["command"]): Promise<ExecutionResult>;
  discover(
    request: GameShapeOf<E>["discovery"]["payload"],
  ): Promise<GameShapeOf<E>["discovery"]["result"]>;
  listAvailableCommands(): Promise<readonly string[]>;
  close(): void;
}
