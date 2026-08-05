import type { DiscoveryStepOption } from "@tableverse-kit/engine";
import type { AnyGameExecutor, GameShapeOf } from "./game-shape.ts";
import type {
  CommandPayload,
  DiscoveryPayload,
  TableverseClient,
} from "./types.ts";

export type DiscoveryStatus =
  | "idle"
  | "discovering"
  | "ready_to_confirm"
  | "executing"
  | "error";

export type OpenResultOf<E extends AnyGameExecutor> = Extract<
  GameShapeOf<E>["discovery"]["result"],
  { complete: false }
>;

export type CompleteResultOf<E extends AnyGameExecutor> = Extract<
  GameShapeOf<E>["discovery"]["result"],
  { complete: true }
>;

/**
 * Per-shape pick-option type. Intersected with the engine's
 * `DiscoveryStepOption` so consumers can rely on `id`/`output`/
 * `nextInput`/`nextStep` even when TS can't fully resolve the
 * `Extract<...>` in a generic context.
 */
export type PickOptionOf<E extends AnyGameExecutor> = (OpenResultOf<E> extends {
  options: ReadonlyArray<infer O>;
}
  ? O
  : never) &
  DiscoveryStepOption;

export type CommandInputOf<E extends AnyGameExecutor> =
  CompleteResultOf<E>["input"];

/**
 * `open` carries a `step: string` and a `ReadonlyArray<PickOptionOf<E>>`
 * of next options. We rebuild the shape via `Omit` rather than
 * intersecting so the `options` field is the per-shape option type (not the
 * engine base) even in a generic-shape context.
 */
export type OpenSnapshotResult<E extends AnyGameExecutor> = Omit<
  OpenResultOf<E>,
  "options"
> & {
  step: string;
  options: Array<PickOptionOf<E>>;
};

export interface DiscoveryStateSnapshot<E extends AnyGameExecutor> {
  /** Command type id being discovered (e.g. "take_three_gems"). Null when idle. */
  readonly activeCommandType: string | null;
  /**
   * Current open step — the engine's `{ complete: false, step, options }`
   * result waiting on the next pick. Null between flows, once the picked
   * input is assembled (pendingInput populated), or while executing.
   */
  readonly open: OpenSnapshotResult<E> | null;
  /** Options picked so far in this flow, in pick order. */
  readonly trail: ReadonlyArray<PickOptionOf<E>>;
  /**
   * Assembled command input ready to send to `execute()`. Populated when
   * discovery returns `{ complete: true }`; null before then.
   */
  readonly pendingInput: CommandInputOf<E> | null;
  readonly status: DiscoveryStatus;
  readonly error: string | null;
}

function createIdleSnapshot<
  E extends AnyGameExecutor,
>(): DiscoveryStateSnapshot<E> {
  return {
    activeCommandType: null,
    open: null,
    trail: [],
    pendingInput: null,
    status: "idle",
    error: null,
  };
}

/**
 * Pure (non-React) discovery state machine.
 *
 * Owns the "active command + accumulated picks + pending input" flow. Drives
 * client.discover and client.execute, surfacing results through a single
 * `subscribe`-style observer interface a renderer can poll.
 *
 * Keyed on the game's executor type `E` (inferred from the client passed to the
 * constructor), the same surface `TableverseClient<E>` uses.
 */
export class DiscoveryState<E extends AnyGameExecutor> {
  private snapshot: DiscoveryStateSnapshot<E> = createIdleSnapshot<E>();
  private readonly listeners = new Set<() => void>();
  private flowId = 0;

  constructor(
    private readonly client: Pick<TableverseClient<E>, "discover" | "execute">,
  ) {}

  getSnapshot(): DiscoveryStateSnapshot<E> {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(payload: GameShapeOf<E>["discovery"]["payload"]): void {
    const flow = ++this.flowId;
    this.setSnapshot({
      activeCommandType: payload.type,
      open: null,
      trail: [],
      pendingInput: null,
      status: "discovering",
      error: null,
    });
    void this.runDiscover(flow, payload);
  }

  pick(option: PickOptionOf<E>): void {
    const current = this.snapshot;
    if (
      current.status !== "discovering" ||
      current.activeCommandType === null
    ) {
      return;
    }
    const flow = ++this.flowId;
    this.setSnapshot({
      ...current,
      trail: [...current.trail, option],
      status: "discovering",
    });
    // The engine guarantees that picking an option from an open result
    // produces a valid next-step payload; TS can't see the constructed
    // shape extends GameShapeOf<E>["discovery"]["payload"] in a generic context.
    void this.runDiscover(flow, {
      type: current.activeCommandType,
      step: option.nextStep,
      input: option.nextInput,
    });
  }

  confirm(): void {
    const current = this.snapshot;
    if (
      current.status !== "ready_to_confirm" ||
      current.activeCommandType === null ||
      current.pendingInput === null
    ) {
      return;
    }
    const flow = ++this.flowId;
    const command = {
      type: current.activeCommandType,
      input: current.pendingInput,
    };
    this.setSnapshot({ ...current, status: "executing" });
    void this.runExecute(flow, command);
  }

  cancel(): void {
    this.flowId++;
    this.setSnapshot(createIdleSnapshot<E>());
  }

  private async runDiscover(
    flow: number,
    payload: DiscoveryPayload,
  ): Promise<void> {
    try {
      // The state machine works in loose payloads; the engine guarantees a
      // valid step/input pair, so narrowing to the game's precise payload at
      // the client boundary is sound.
      const result = await this.client.discover(
        payload as GameShapeOf<E>["discovery"]["payload"],
      );
      if (this.flowId !== flow) return;

      if (result.complete) {
        this.setSnapshot({
          ...this.snapshot,
          open: null,
          pendingInput: result.input,
          status: "ready_to_confirm",
        });
      } else {
        this.setSnapshot({
          ...this.snapshot,
          // `complete` is false here, so this is the open result; the deferred
          // discovery-result type doesn't narrow on `complete`, so assert the
          // open shape through `unknown`.
          open: result as unknown as OpenSnapshotResult<E>,
          status: "discovering",
        });
      }
    } catch (error) {
      if (this.flowId !== flow) return;
      this.setSnapshot({
        ...this.snapshot,
        status: "error",
        error: errorMessage(error),
      });
    }
  }

  private async runExecute(
    flow: number,
    command: CommandPayload,
  ): Promise<void> {
    try {
      const result = await this.client.execute(
        command as GameShapeOf<E>["command"],
      );
      if (this.flowId !== flow) return;

      if (result.accepted) {
        this.setSnapshot(createIdleSnapshot<E>());
      } else {
        this.setSnapshot({
          ...this.snapshot,
          status: "error",
          error: result.reason ?? "execution_rejected",
        });
      }
    } catch (error) {
      if (this.flowId !== flow) return;
      this.setSnapshot({
        ...this.snapshot,
        status: "error",
        error: errorMessage(error),
      });
    }
  }

  private setSnapshot(next: DiscoveryStateSnapshot<E>): void {
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "unknown_error";
}
