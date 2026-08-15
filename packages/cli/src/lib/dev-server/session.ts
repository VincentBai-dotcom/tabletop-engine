import { createGameExecutor } from "@tableverse-kit/engine";
import type {
  AnyGameDefinition,
  AnyGameExecutor,
  CanonicalState,
  GameEvent,
  Viewer,
} from "@tableverse-kit/engine";

export interface Snapshot {
  viewerId: string;
  view: unknown;
  version: number;
}

export interface ExecuteOutcome {
  result: { accepted: boolean; reason?: string };
  events: GameEvent[];
}

export interface CommandRequest {
  type: string;
  input: Record<string, unknown>;
}

export interface DiscoveryRequest {
  type: string;
  step: string;
  input: Record<string, unknown>;
}

export class DevSession {
  readonly #executor: AnyGameExecutor;
  #state: CanonicalState | null = null;
  #version = 0;

  constructor(game: AnyGameDefinition) {
    this.#executor = createGameExecutor(game);
  }

  get initialized(): boolean {
    return this.#state !== null;
  }

  get version(): number {
    return this.#version;
  }

  initialize(setupInput: unknown, seed: string | number = "dev"): void {
    if (this.#state) {
      return;
    }
    // `createInitialState` is dual-arity: `(seed)` without setup input, `(input,
    // seed)` with it. The loose executor's type surfaces only the former, so the
    // setup-input branch reaches for the latter explicitly.
    const withSetup = this.#executor.createInitialState as (
      input: unknown,
      rngSeed: string | number,
    ) => CanonicalState;
    this.#state =
      setupInput === undefined
        ? this.#executor.createInitialState(seed)
        : withSetup(setupInput, seed);
    this.#version = 1;
  }

  snapshotFor(viewer: string): Snapshot {
    return {
      viewerId: viewer,
      view: this.#executor.getView(this.#requireState(), player(viewer)),
      version: this.#version,
    };
  }

  availableCommands(viewer: string): string[] {
    return this.#executor.listAvailableCommands(this.#requireState(), {
      actorId: viewer,
    });
  }

  discover(viewer: string, request: DiscoveryRequest): unknown {
    return this.#executor.discoverCommand(this.#requireState(), {
      type: request.type,
      step: request.step,
      actorId: viewer,
      input: request.input,
    });
  }

  execute(viewer: string, command: CommandRequest): ExecuteOutcome {
    const result = this.#executor.executeCommand(this.#requireState(), {
      type: command.type,
      actorId: viewer,
      input: command.input,
    });
    this.#state = result.state;
    if (result.ok) {
      this.#version += 1;
    }
    return {
      result: result.ok
        ? { accepted: true }
        : { accepted: false, reason: result.reason },
      events: result.events,
    };
  }

  #requireState(): CanonicalState {
    if (!this.#state) {
      throw new Error("not_initialized");
    }
    return this.#state;
  }
}

function player(playerId: string): Viewer {
  return { kind: "player", playerId };
}
