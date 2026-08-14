import type { AnyCommandDiscoveryResult } from "@tableverse-kit/engine";
import type { AnyGameExecutor, GameShapeOf } from "./game-shape.ts";
import type { ConnectionStatus } from "./lifecycle.ts";

/**
 * Discovery result union — open (more options to pick) or complete
 * (ready to confirm). Re-exported from the engine.
 */
export type DiscoveryResult = AnyCommandDiscoveryResult;

export interface ExecutionResult {
  accepted: boolean;
  reason?: string;
}

/**
 * The client the game frontend talks to. Parameterized by the game's
 * `GameExecutor` type; the view / command / discovery / event shapes are all
 * derived from it via `GameShapeOf` — nothing is hand-authored.
 */
export interface TableverseClient<E extends AnyGameExecutor> {
  getStatus(): ConnectionStatus;
  getViewerId(): string | null;
  ready(): Promise<void>;

  getView(): GameShapeOf<E>["view"] | null;
  getAvailableCommands(): Promise<readonly string[]>;
  getStateVersion(): number | null;

  subscribe(listener: () => void): () => void;
  onEvent(listener: (event: GameShapeOf<E>["event"]) => void): () => void;

  discover(
    request: GameShapeOf<E>["discovery"]["payload"],
  ): Promise<GameShapeOf<E>["discovery"]["result"]>;
  execute(command: GameShapeOf<E>["command"]): Promise<ExecutionResult>;

  dispose(): void;
}
