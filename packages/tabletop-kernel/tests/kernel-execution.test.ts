import { expect, test } from "bun:test";
import { createGameExecutor } from "../src/runtime/game-executor";
import { GameDefinitionBuilder } from "../src/game-definition";
import { evaluateCompletionPolicy } from "../src/runtime/progression-lifecycle";
import {
  createProgressionCompletionContext,
  createProgressionLifecycleHookContext,
} from "../src/runtime/contexts";
import { createEventCollector } from "../src/runtime/events";
import { createRNGService } from "../src/rng/service";
import {
  field,
  hidden,
  OwnedByPlayer,
  State,
  t,
  visibleToSelf,
} from "../src/state-facade/metadata";

const emptyPayload = t.object({});
const amountPayload = t.object({
  amount: t.optional(t.number()),
});
const playCardPayload = t.object({
  cardId: t.optional(t.number()),
});

@State()
class CounterStateFacade {
  @field(t.number())
  value!: number;

  increment(amount: number) {
    this.value += amount;
  }
}

@State()
class RootCounterStateFacade {
  @field(t.state(() => CounterStateFacade))
  counter!: CounterStateFacade;

  incrementCounter(amount: number) {
    this.counter.increment(amount);
  }

  hasCounterValueAtLeast(minimum: number) {
    return this.counter.value >= minimum;
  }
}

@OwnedByPlayer()
@State()
class VisiblePlayerState {
  @field(t.string())
  id!: string;

  @visibleToSelf()
  @field(t.array(t.string()))
  hand!: string[];

  @field(t.number())
  score!: number;
}

@State()
class VisibleRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => VisiblePlayerState),
    ),
  )
  players!: Record<string, VisiblePlayerState>;
}

@State()
class HiddenDeckState {
  @hidden()
  @field(t.array(t.string()))
  cards!: string[];
}

@State()
class HiddenDeckRootState {
  @field(t.state(() => HiddenDeckState))
  deck!: HiddenDeckState;
}

@State()
class CustomVisibleDeckState {
  @hidden()
  @field(t.array(t.string()))
  cards!: string[];

  projectCustomView() {
    return {
      count: this.cards.length,
    };
  }
}

@State()
class CustomVisibleDeckRootState {
  @field(t.state(() => CustomVisibleDeckState))
  deck!: CustomVisibleDeckState;
}

test("createGameExecutor hydrates decorated state facades for execution", () => {
  const game = new GameDefinitionBuilder<{
    counter: {
      value: number;
    };
  }>("facade-counter-game")
    .rootState(RootCounterStateFacade)
    .initialState(() => ({
      counter: {
        value: 0,
      },
    }))
    .commands({
      increment_counter: {
        commandId: "increment_counter",
        payloadSchema: amountPayload,
        validate: () => ({ ok: true as const }),
        execute: ({ game, commandInput }) => {
          const amount =
            typeof commandInput.payload?.amount === "number"
              ? commandInput.payload.amount
              : 1;

          (game as RootCounterStateFacade).incrementCounter(amount);
        },
      },
    })
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();
  const result = executor.executeCommand(initialState, {
    type: "increment_counter",
    payload: {
      amount: 3,
    },
  });

  expect(initialState.game.counter.value).toBe(0);
  expect(result.ok).toBe(true);
  expect(result.state.game.counter.value).toBe(3);
});

test("createGameExecutor can project viewer-safe visible state", () => {
  const game = new GameDefinitionBuilder<{
    counter: {
      value: number;
    };
  }>("visible-state-game")
    .rootState(RootCounterStateFacade)
    .initialState(() => ({
      counter: {
        value: 2,
      },
    }))
    .commands({})
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        children: [],
      },
    })
    .build();

  const executor = createGameExecutor(game) as {
    createInitialState(): {
      game: { counter: { value: number } };
      runtime: {
        progression: unknown;
        rng: unknown;
        history: unknown;
      };
    };
    getView(
      state: unknown,
      viewer: { kind: "spectator" } | { kind: "player"; playerId: string },
    ): unknown;
  };
  const state = executor.createInitialState();
  const visibleState = executor.getView(state, {
    kind: "spectator",
  }) as {
    game: { counter: { value: number } };
    progression: unknown;
    rng?: unknown;
    history?: unknown;
  };

  expect(visibleState.game.counter.value).toBe(2);
  expect(visibleState.progression).toBeDefined();
  expect("rng" in visibleState).toBe(false);
  expect("history" in visibleState).toBe(false);
});

test("createGameExecutor projects visibleToSelf fields for the owner only", () => {
  const game = new GameDefinitionBuilder<{
    players: Record<
      string,
      {
        id: string;
        hand: string[];
        score: number;
      }
    >;
  }>("private-hand-game")
    .rootState(VisibleRootState)
    .initialState(() => ({
      players: {
        p1: {
          id: "p1",
          hand: ["a", "b"],
          score: 3,
        },
        p2: {
          id: "p2",
          hand: ["x"],
          score: 2,
        },
      },
    }))
    .commands({})
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        children: [],
      },
    })
    .build();

  const executor = createGameExecutor(game) as {
    createInitialState(): unknown;
    getView(
      state: unknown,
      viewer: { kind: "spectator" } | { kind: "player"; playerId: string },
    ): {
      game: {
        players: Record<
          string,
          {
            id: string;
            score: number;
            hand: string[] | { __hidden: true; value?: unknown };
          }
        >;
      };
      progression: unknown;
    };
  };
  const state = executor.createInitialState();
  const visibleForP1 = executor.getView(state, {
    kind: "player",
    playerId: "p1",
  });
  const visibleForSpectator = executor.getView(state, {
    kind: "spectator",
  });

  expect(visibleForP1.game.players.p1?.hand).toEqual(["a", "b"]);
  expect(visibleForP1.game.players.p2?.hand).toEqual({
    __hidden: true,
  });
  expect(visibleForSpectator.game.players.p1?.hand).toEqual({
    __hidden: true,
  });
  expect(visibleForSpectator.game.players.p2?.hand).toEqual({
    __hidden: true,
  });
});

test("createGameExecutor projects hidden fields for every viewer", () => {
  const game = new GameDefinitionBuilder<{
    deck: {
      cards: string[];
    };
  }>("hidden-deck-game")
    .rootState(HiddenDeckRootState)
    .initialState(() => ({
      deck: {
        cards: ["a", "b", "c"],
      },
    }))
    .commands({})
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        children: [],
      },
    })
    .build();

  const executor = createGameExecutor(game) as {
    createInitialState(): unknown;
    getView(
      state: unknown,
      viewer: { kind: "spectator" } | { kind: "player"; playerId: string },
    ): {
      game: {
        deck: {
          cards: { __hidden: true; value?: unknown };
        };
      };
    };
  };
  const state = executor.createInitialState();
  const visibleForPlayer = executor.getView(state, {
    kind: "player",
    playerId: "p1",
  });
  const visibleForSpectator = executor.getView(state, {
    kind: "spectator",
  });

  expect(visibleForPlayer.game.deck.cards).toEqual({
    __hidden: true,
  });
  expect(visibleForSpectator.game.deck.cards).toEqual({
    __hidden: true,
  });
});

test("createGameExecutor lets a state override its visible projection shape", () => {
  const game = new GameDefinitionBuilder<{
    deck: {
      cards: string[];
    };
  }>("custom-visible-deck-game")
    .rootState(CustomVisibleDeckRootState)
    .initialState(() => ({
      deck: {
        cards: ["a", "b", "c"],
      },
    }))
    .commands({})
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        children: [],
      },
    })
    .build();

  const executor = createGameExecutor(game) as {
    createInitialState(): unknown;
    getView(
      state: unknown,
      viewer: { kind: "spectator" } | { kind: "player"; playerId: string },
    ): {
      game: {
        deck: {
          count: number;
        };
      };
    };
  };
  const state = executor.createInitialState();
  const visibleState = executor.getView(state, {
    kind: "spectator",
  });

  expect(visibleState.game.deck).toEqual({
    count: 3,
  });
});

test("createGameExecutor rejects owned player projection when id is empty", () => {
  const game = new GameDefinitionBuilder<{
    players: Record<
      string,
      {
        id: string;
        hand: string[];
        score: number;
      }
    >;
  }>("invalid-player-owner-game")
    .rootState(VisibleRootState)
    .initialState(() => ({
      players: {
        p1: {
          id: "",
          hand: ["a", "b"],
          score: 3,
        },
      },
    }))
    .commands({})
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        children: [],
      },
    })
    .build();

  const executor = createGameExecutor(game);
  const state = executor.createInitialState();

  expect(() =>
    executor.getView(state, {
      kind: "spectator",
    }),
  ).toThrow("owned_player_requires_non_empty_id_value:VisiblePlayerState");
});

test("availability and discovery contexts hydrate readonly decorated state facades", () => {
  const game = new GameDefinitionBuilder<{
    counter: {
      value: number;
    };
  }>("readonly-facade-discovery-game")
    .rootState(RootCounterStateFacade)
    .initialState(() => ({
      counter: {
        value: 2,
      },
    }))
    .commands({
      increment_counter: {
        commandId: "increment_counter",
        payloadSchema: amountPayload,
        isAvailable: ({ game }) =>
          (game as RootCounterStateFacade).hasCounterValueAtLeast(1),
        discover: ({ game, partialCommand }) => {
          if ((game as RootCounterStateFacade).hasCounterValueAtLeast(2)) {
            return {
              step: "select_amount",
              options: [{ id: "two", value: 2 }],
              nextPartialCommand: partialCommand,
            };
          }

          return {
            step: "select_amount",
            options: [{ id: "one", value: 1 }],
          };
        },
        validate: () => ({ ok: true as const }),
        execute: ({ game, commandInput }) => {
          const amount =
            typeof commandInput.payload?.amount === "number"
              ? commandInput.payload.amount
              : 1;

          (game as RootCounterStateFacade).incrementCounter(amount);
        },
      },
    })
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();

  expect(executor.listAvailableCommands(initialState)).toEqual([
    "increment_counter",
  ]);
  expect(
    executor.discoverCommand(initialState, {
      type: "increment_counter",
      payload: {},
    }),
  ).toMatchObject({
    step: "select_amount",
    options: [{ id: "two", value: 2 }],
  });
  expect(initialState.game.counter.value).toBe(2);
});

test("readonly decorated facades reject mutation during validation", () => {
  const game = new GameDefinitionBuilder<{
    counter: {
      value: number;
    };
  }>("readonly-facade-validation-game")
    .rootState(RootCounterStateFacade)
    .initialState(() => ({
      counter: {
        value: 0,
      },
    }))
    .commands({
      increment_counter: {
        commandId: "increment_counter",
        payloadSchema: emptyPayload,
        validate: ({ game }) => {
          (game as RootCounterStateFacade).incrementCounter(1);
          return { ok: true as const };
        },
        execute: () => {},
      },
    })
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();

  expect(() =>
    executor.executeCommand(initialState, {
      type: "increment_counter",
    }),
  ).toThrow("readonly_state_facade_mutation:value");
  expect(initialState.game.counter.value).toBe(0);
});

test("createGameExecutor creates initial state and commits successful commands", () => {
  const game = new GameDefinitionBuilder<{
    counter: number;
  }>("counter-game")
    .initialState(() => ({
      counter: 0,
    }))
    .commands({
      increment_counter: {
        commandId: "increment_counter",
        payloadSchema: amountPayload,
        validate: () => ({ ok: true as const }),
        execute: ({ game, commandInput, emitEvent }) => {
          const amount =
            typeof commandInput.payload?.amount === "number"
              ? commandInput.payload.amount
              : 1;

          game.counter += amount;
          emitEvent({
            category: "domain",
            type: "counter_incremented",
            payload: { amount },
          });
        },
      },
      decrement_counter: {
        commandId: "decrement_counter",
        payloadSchema: emptyPayload,
        validate: ({ game }) =>
          game.counter > 0
            ? { ok: true as const }
            : {
                ok: false as const,
                reason: "counter_is_zero",
              },
        execute: ({ game }) => {
          game.counter -= 1;
        },
      },
    })
    .rngSeed("test-seed")
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const success = gameExecutor.executeCommand(initialState, {
    type: "increment_counter",
    payload: { amount: 2 },
  });

  expect(initialState.game.counter).toBe(0);
  expect(initialState.runtime.rng.seed).toBe("test-seed");
  expect(success.ok).toBe(true);
  expect(success.state.game.counter).toBe(2);
  expect(success.events).toHaveLength(1);
  expect(success.events[0]?.type).toBe("counter_incremented");
});

test("createGameExecutor returns unchanged state for validation failures", () => {
  const game = new GameDefinitionBuilder<{
    counter: number;
  }>("counter-game")
    .initialState(() => ({
      counter: 0,
    }))
    .commands({
      decrement_counter: {
        commandId: "decrement_counter",
        payloadSchema: emptyPayload,
        validate: ({ game }) =>
          game.counter > 0
            ? { ok: true as const }
            : {
                ok: false as const,
                reason: "counter_is_zero",
                metadata: { minimum: 1 },
              },
        execute: ({ game }) => {
          game.counter -= 1;
        },
      },
    })
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const failure = gameExecutor.executeCommand(initialState, {
    type: "decrement_counter",
  });

  expect(failure.ok).toBe(false);

  if (failure.ok) {
    throw new Error("expected validation failure");
  }

  expect(failure.state).toBe(initialState);
  expect(failure.state.game.counter).toBe(0);
  expect(failure.reason).toBe("counter_is_zero");
  expect(failure.metadata).toEqual({ minimum: 1 });
  expect(failure.events).toHaveLength(0);
});

test("execute context can update current progression owner through controlled API", () => {
  const game = new GameDefinitionBuilder<{
    marker: number;
  }>("turn-game")
    .initialState(() => ({
      marker: 0,
    }))
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        children: [],
      },
    })
    .setup(({ runtime }) => {
      runtime.progression.segments.turn!.ownerId = "player-1";
    })
    .commands({
      pass_turn: {
        commandId: "pass_turn",
        payloadSchema: emptyPayload,
        validate: () => ({ ok: true as const }),
        execute: ({ setCurrentSegmentOwner }) => {
          setCurrentSegmentOwner("player-2");
        },
      },
    })
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const result = gameExecutor.executeCommand(initialState, {
    type: "pass_turn",
  });

  expect(initialState.runtime.progression.segments.turn?.ownerId).toBe(
    "player-1",
  );
  expect(result.ok).toBe(true);
  expect(result.state.runtime.progression.segments.turn?.ownerId).toBe(
    "player-2",
  );
});

test("built-in progression completion policies evaluate through lifecycle contexts", () => {
  const state = {
    game: {
      counter: 0,
    },
    runtime: {
      progression: {
        current: "turn",
        rootId: "turn",
        segments: {
          turn: {
            id: "turn",
            childIds: [],
            active: true,
            ownerId: "player-1",
          },
        },
      },
      rng: {
        seed: "seed",
        cursor: 0,
      },
      history: {
        entries: [],
      },
    },
  };
  const commandInput = {
    type: "take_action",
    actorId: "player-1",
  };
  const completionContext = createProgressionCompletionContext(
    state,
    state.game,
    commandInput,
    state.runtime.progression.segments.turn!,
  );
  const collector = createEventCollector();
  const lifecycleContext = createProgressionLifecycleHookContext(
    state,
    state.game,
    commandInput,
    state.runtime.progression.segments.turn!,
    createRNGService(state.runtime.rng),
    collector.emit,
  );

  expect(
    evaluateCompletionPolicy("after_successful_command", completionContext),
  ).toBe(true);
  expect(evaluateCompletionPolicy("manual_only", completionContext)).toBe(
    false,
  );
  expect(completionContext.progression.current()?.id).toBe("turn");
  expect(completionContext.progression.parent()?.id).toBeUndefined();
  expect(
    lifecycleContext.progression.activePath().map((segment) => segment.id),
  ).toEqual(["turn"]);
});

test("successful commands trigger automatic progression lifecycle and emit lifecycle events", () => {
  const game = new GameDefinitionBuilder<{
    actions: number;
  }>("auto-turn-game")
    .initialState(() => ({
      actions: 0,
    }))
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        completionPolicy: "after_successful_command",
        onExit: ({ emitEvent, game }) => {
          const turnGame = game as { actions: number };

          emitEvent({
            category: "runtime",
            type: "turn_cleanup",
            payload: {
              actions: turnGame.actions,
            },
          });
        },
        resolveNext: ({ segment }) => ({
          nextSegmentId: "turn",
          ownerId: segment.ownerId === "player-1" ? "player-2" : "player-1",
        }),
        children: [],
      },
    })
    .setup(({ runtime }) => {
      runtime.progression.segments.turn!.ownerId = "player-1";
    })
    .commands({
      take_action: {
        commandId: "take_action",
        payloadSchema: emptyPayload,
        validate: () => ({ ok: true as const }),
        execute: ({ game, emitEvent }) => {
          game.actions += 1;
          emitEvent({
            category: "domain",
            type: "action_taken",
            payload: {
              amount: 1,
            },
          });
        },
      },
    })
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const result = gameExecutor.executeCommand(initialState, {
    type: "take_action",
    actorId: "player-1",
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("expected automatic lifecycle progression");
  }

  expect(result.state.game.actions).toBe(1);
  expect(result.state.runtime.progression.current).toBe("turn");
  expect(result.state.runtime.progression.segments.turn?.ownerId).toBe(
    "player-2",
  );
  expect(result.events.map((event) => event.type)).toEqual([
    "action_taken",
    "turn_cleanup",
    "segment_exited",
    "segment_entered",
  ]);
  expect(result.events[3]).toMatchObject({
    category: "runtime",
    type: "segment_entered",
    payload: {
      segmentId: "turn",
      ownerId: "player-2",
    },
  });
});

test("progression lifecycle hooks hydrate decorated state facades", () => {
  const game = new GameDefinitionBuilder<{
    counter: {
      value: number;
    };
  }>("facade-progression-game")
    .rootState(RootCounterStateFacade)
    .initialState(() => ({
      counter: {
        value: 0,
      },
    }))
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        completionPolicy: "after_successful_command",
        onExit: ({ game }) => {
          (game as RootCounterStateFacade).incrementCounter(2);
        },
        resolveNext: ({ game }) => ({
          nextSegmentId: "turn",
          ownerId: (game as RootCounterStateFacade).hasCounterValueAtLeast(3)
            ? "player-2"
            : "player-1",
        }),
        children: [],
      },
    })
    .setup(({ runtime }) => {
      runtime.progression.segments.turn!.ownerId = "player-1";
    })
    .commands({
      increment_counter: {
        commandId: "increment_counter",
        payloadSchema: emptyPayload,
        validate: () => ({ ok: true as const }),
        execute: ({ game }) => {
          (game as RootCounterStateFacade).incrementCounter(1);
        },
      },
    })
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();
  const result = executor.executeCommand(initialState, {
    type: "increment_counter",
    actorId: "player-1",
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("expected lifecycle progression to succeed");
  }

  expect(result.state.game.counter.value).toBe(3);
  expect(result.state.runtime.progression.segments.turn?.ownerId).toBe(
    "player-2",
  );
});

test("nested progression can cascade through multiple segment transitions", () => {
  const game = new GameDefinitionBuilder<{
    resolved: number;
  }>("nested-progression-game")
    .initialState(() => ({
      resolved: 0,
    }))
    .progression({
      root: {
        id: "round",
        kind: "round",
        children: [
          {
            id: "turn",
            kind: "turn",
            completionPolicy: "after_successful_command",
            resolveNext: ({ segment }) => ({
              nextSegmentId: "turn",
              ownerId: segment.ownerId === "player-1" ? "player-2" : "player-1",
            }),
            children: [
              {
                id: "step",
                kind: "step",
                completionPolicy: "after_successful_command",
                children: [],
              },
            ],
          },
        ],
      },
    })
    .setup(({ runtime }) => {
      runtime.progression.segments.turn!.ownerId = "player-1";
    })
    .commands({
      resolve_step: {
        commandId: "resolve_step",
        payloadSchema: emptyPayload,
        validate: () => ({ ok: true as const }),
        execute: ({ game }) => {
          game.resolved += 1;
        },
      },
    })
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const result = gameExecutor.executeCommand(initialState, {
    type: "resolve_step",
    actorId: "player-1",
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("expected nested lifecycle progression");
  }

  expect(result.state.runtime.progression.current).toBe("step");
  expect(result.state.runtime.progression.segments.turn?.ownerId).toBe(
    "player-2",
  );
  expect(result.state.runtime.progression.segments.round?.active).toBe(true);
  expect(result.state.runtime.progression.segments.turn?.active).toBe(true);
  expect(result.state.runtime.progression.segments.step?.active).toBe(true);
  expect(
    result.events.filter((event) => event.type === "segment_exited"),
  ).toHaveLength(2);
  expect(
    result.events.filter((event) => event.type === "segment_entered"),
  ).toHaveLength(2);
});

test("manual progression paths can avoid auto-advancing ordinary commands and still end explicitly", () => {
  const game = new GameDefinitionBuilder<{
    actions: number;
    requestedTurnEnd: boolean;
  }>("manual-turn-game")
    .initialState(() => ({
      actions: 0,
      requestedTurnEnd: false,
    }))
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        completionPolicy: ({ game, commandInput }) => {
          const manualGame = game as { requestedTurnEnd: boolean };

          return (
            commandInput.type === "end_turn" && manualGame.requestedTurnEnd
          );
        },
        resolveNext: ({ segment }) => ({
          nextSegmentId: "turn",
          ownerId: segment.ownerId === "player-1" ? "player-2" : "player-1",
        }),
        children: [],
      },
    })
    .setup(({ runtime }) => {
      runtime.progression.segments.turn!.ownerId = "player-1";
    })
    .commands({
      take_action: {
        commandId: "take_action",
        payloadSchema: emptyPayload,
        validate: () => ({ ok: true as const }),
        execute: ({ game }) => {
          game.actions += 1;
        },
      },
      end_turn: {
        commandId: "end_turn",
        payloadSchema: emptyPayload,
        validate: () => ({ ok: true as const }),
        execute: ({ game }) => {
          game.requestedTurnEnd = true;
        },
      },
    })
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const actionResult = gameExecutor.executeCommand(initialState, {
    type: "take_action",
    actorId: "player-1",
  });

  expect(actionResult.ok).toBe(true);

  if (!actionResult.ok) {
    throw new Error("expected ordinary action to succeed");
  }

  expect(actionResult.state.runtime.progression.segments.turn?.ownerId).toBe(
    "player-1",
  );
  expect(
    actionResult.events.filter((event) => event.type === "segment_entered"),
  ).toHaveLength(0);
  expect(
    actionResult.events.filter((event) => event.type === "segment_exited"),
  ).toHaveLength(0);

  const endTurnResult = gameExecutor.executeCommand(actionResult.state, {
    type: "end_turn",
    actorId: "player-1",
  });

  expect(endTurnResult.ok).toBe(true);

  if (!endTurnResult.ok) {
    throw new Error("expected explicit end-turn to succeed");
  }

  expect(endTurnResult.state.runtime.progression.segments.turn?.ownerId).toBe(
    "player-2",
  );
  expect(
    endTurnResult.events.filter((event) => event.type === "segment_exited"),
  ).toHaveLength(1);
  expect(
    endTurnResult.events.filter((event) => event.type === "segment_entered"),
  ).toHaveLength(1);
});

test("game executor can list available commands through per-command availability hooks", () => {
  const game = new GameDefinitionBuilder<{
    energy: number;
  }>("availability-game")
    .initialState(() => ({
      energy: 1,
    }))
    .commands({
      pass_turn: {
        commandId: "pass_turn",
        payloadSchema: emptyPayload,
        isAvailable: () => true,
        validate: () => ({ ok: true as const }),
        execute: () => {},
      },
      spend_energy: {
        commandId: "spend_energy",
        payloadSchema: emptyPayload,
        isAvailable: ({ game }) => game.energy > 0,
        validate: ({ game }) =>
          game.energy > 0
            ? { ok: true as const }
            : { ok: false as const, reason: "no_energy" },
        execute: ({ game }) => {
          game.energy -= 1;
        },
      },
      impossible_action: {
        commandId: "impossible_action",
        payloadSchema: emptyPayload,
        isAvailable: () => false,
        validate: () => ({ ok: true as const }),
        execute: () => {},
      },
    })
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();

  expect(
    gameExecutor.listAvailableCommands(initialState, { actorId: "player-1" }),
  ).toEqual(["pass_turn", "spend_energy"]);

  const nextState = gameExecutor.executeCommand(initialState, {
    type: "spend_energy",
    actorId: "player-1",
  });

  expect(nextState.ok).toBe(true);

  if (!nextState.ok) {
    throw new Error("expected spending energy to succeed");
  }

  expect(
    gameExecutor.listAvailableCommands(nextState.state, {
      actorId: "player-1",
    }),
  ).toEqual(["pass_turn"]);
});

test("game executor can discover the next semantic options for a command", () => {
  const game = new GameDefinitionBuilder<{
    canPlay: boolean;
  }>("discovery-game")
    .initialState(() => ({
      canPlay: true,
    }))
    .commands({
      play_card: {
        commandId: "play_card",
        payloadSchema: playCardPayload,
        isAvailable: ({ game }) => game.canPlay,
        discover: ({ partialCommand }) => {
          const cardId = partialCommand.payload?.cardId;

          if (typeof cardId !== "number") {
            return {
              step: "select_card",
              options: [
                { id: "card-1", value: 1 },
                { id: "card-2", value: 2 },
              ],
            };
          }

          return {
            step: "select_target",
            options: [{ id: "target-1", value: 101 }],
            nextPartialCommand: partialCommand,
          };
        },
        validate: () => ({ ok: true as const }),
        execute: () => {},
      },
    })
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const firstStep = gameExecutor.discoverCommand(initialState, {
    type: "play_card",
    actorId: "player-1",
  });
  const secondStep = gameExecutor.discoverCommand(initialState, {
    type: "play_card",
    actorId: "player-1",
    payload: {
      cardId: 2,
    },
  });

  expect(firstStep).toMatchObject({
    step: "select_card",
  });
  expect(firstStep?.options).toHaveLength(2);
  expect(secondStep).toMatchObject({
    step: "select_target",
  });
  expect(secondStep?.options[0]).toEqual({ id: "target-1", value: 101 });
});
