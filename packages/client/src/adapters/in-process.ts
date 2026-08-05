import type {
  AnyGameStateDefinition,
  CanonicalState,
  CanonicalStateOf,
  EventRegistry,
  GameEvent,
  GameExecutor,
} from "@tableverse-kit/engine";
import type { AnyGameExecutor, GameShapeOf } from "../client/game-shape.ts";
import type { TableverseClient } from "../client/types.ts";

export interface CreateInProcessClientOptions<
  RootState extends AnyGameStateDefinition,
> {
  viewerId: string;
  initialState: CanonicalState<CanonicalStateOf<RootState>>;
}

/**
 * In-process implementation of TableverseClient. Wraps a GameExecutor; runs the
 * engine in the same JavaScript context as the UI. All async methods resolve
 * synchronously through Promise.resolve, so single-player games never wait
 * on a network.
 *
 * The customer constructs the initial state externally (typically with
 * `executor.createInitialState(...)`, or by restoring a snapshot / starting
 * a replay) and hands it in. The adapter owns the running-game phase: state
 * mutation, subscriber notification, event fan-out.
 *
 * All type parameters are inferred from the `executor` argument; the returned
 * client's view / command / discovery / event shapes come from its
 * `GameExecutor` type via `GameShapeOf`. Nothing is hand-authored.
 */
export function createInProcessClient<
  RootState extends AnyGameStateDefinition,
  SetupInput extends object | undefined = undefined,
  TCommandDefinition = never,
  TEventRegistry extends EventRegistry = EventRegistry,
>(
  executor: GameExecutor<
    RootState,
    SetupInput,
    TCommandDefinition,
    TEventRegistry
  >,
  options: CreateInProcessClientOptions<RootState>,
): TableverseClient<
  GameExecutor<RootState, SetupInput, TCommandDefinition, TEventRegistry>
> {
  type E = GameExecutor<
    RootState,
    SetupInput,
    TCommandDefinition,
    TEventRegistry
  >;
  type EventOut = GameShapeOf<E>["event"];

  let state = options.initialState;
  let version = 0;
  let currentViewerId = options.viewerId;
  const subscribers = new Set<() => void>();
  const eventListeners = new Set<(event: EventOut) => void>();
  let disposed = false;

  const notifySubscribers = (): void => {
    for (const listener of subscribers) listener();
  };

  // `executor.executeCommand` returns loosely-typed `GameEvent[]`; the engine
  // validated every emitted event against the registry, so narrowing to the
  // derived event union here is sound.
  const emitEvents = (events: ReadonlyArray<GameEvent>): void => {
    for (const event of events) {
      for (const listener of eventListeners) {
        listener(event as EventOut);
      }
    }
  };

  const ensureLive = (): void => {
    if (disposed) {
      throw new Error("createInProcessClient: client has been disposed");
    }
  };

  // After every successful execute, align the viewer with the new active
  // player so local pass-and-play works automatically. No-op for
  // single-player (active player is always the same), and skipped for
  // automatic / multi-active-player stages where there is no single
  // active player to switch to.
  const alignViewerWithActivePlayer = (
    nextState: CanonicalState<CanonicalStateOf<RootState>>,
  ): void => {
    const stage = nextState.runtime.progression.currentStage;
    if (stage.kind !== "activePlayer") return;
    if (stage.activePlayerId === currentViewerId) return;
    currentViewerId = stage.activePlayerId;
  };

  return {
    get viewerId() {
      return currentViewerId;
    },

    getView() {
      if (disposed) return null;
      return executor.getView(state, {
        kind: "player",
        playerId: currentViewerId,
      });
    },

    async getAvailableCommands() {
      if (disposed) return [];
      return executor.listAvailableCommands(state, {
        actorId: currentViewerId,
      });
    },

    getStateVersion() {
      return disposed ? null : version;
    },

    subscribe(listener) {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },

    onEvent(listener) {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },

    async discover(payload) {
      ensureLive();
      const { type, step, input } = payload;
      const result = executor.discoverCommand(state, {
        type,
        actorId: currentViewerId,
        step,
        input,
      });
      if (result === null) {
        throw new Error(`discover: command "${type}" has no discovery defined`);
      }
      return result;
    },

    async execute(command) {
      ensureLive();
      const { type, input } = command;
      const result = executor.executeCommand(state, {
        type,
        actorId: currentViewerId,
        // `input` is the game's precise per-command type, deferred to `unknown`
        // in this generic body; the engine re-validates it against the schema.
        input: input as Record<string, unknown>,
      });

      if (!result.ok) {
        return { accepted: false, reason: result.reason };
      }

      state = result.state;
      version += 1;
      alignViewerWithActivePlayer(state);
      notifySubscribers();
      emitEvents(result.events);
      return { accepted: true };
    },

    dispose() {
      disposed = true;
      subscribers.clear();
      eventListeners.clear();
    },
  };
}

/**
 * Convenience alias: name a game's in-process client type from its executor,
 * e.g. `type SplendorClient = InProcessClient<typeof splendorExecutor>;`.
 */
export type InProcessClient<E extends AnyGameExecutor> = TableverseClient<E>;
