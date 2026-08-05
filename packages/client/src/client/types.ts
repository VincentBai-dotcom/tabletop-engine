import type {
  AnyCommandDiscoveryResult,
  Command,
  Discovery,
} from "@tableverse-kit/engine";
import type { AnyGameExecutor, GameShapeOf } from "./game-shape.ts";

/**
 * Client-side command payload. The engine's `Command` carries `actorId`,
 * which the adapter fills in from the active viewer — UI consumers must
 * not author it. Loose, actorId-stripped shape; a game's precise per-command
 * payload is `GameShapeOf<E>["command"]`.
 */
export type CommandPayload = Omit<Command, "actorId">;

/**
 * Client-side discovery payload. Same actorId story as `CommandPayload`.
 */
export type DiscoveryPayload = Omit<Discovery, "actorId">;

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
  readonly viewerId: string;

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
