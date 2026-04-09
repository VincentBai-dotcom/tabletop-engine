import { expect, test } from "bun:test";
import { createCommandFactory } from "../src/command-factory";
import { createStageFactory } from "../src/stage-factory";
import { createGameExecutor } from "../src/runtime/game-executor";
import { GameDefinitionBuilder } from "../src/game-definition";
import {
  field,
  hidden,
  OwnedByPlayer,
  State,
  t,
  visibleToSelf,
} from "../src/state-facade/metadata";
import {
  createSelfLoopingTurnStage,
  createTerminalStage,
} from "./helpers/stages";
import type { SingleActivePlayerStageDefinition } from "../src/types/progression";

const emptyCommandSchema = t.object({});
const amountCommandSchema = t.object({
  amount: t.optional(t.number()),
});
const playCardCommandSchema = t.object({
  cardId: t.optional(t.number()),
});

@State()
class CounterStateFacade {
  @field(t.number())
  value = 0;

  increment(amount: number) {
    this.value += amount;
  }
}

@State()
class RootCounterStateFacade {
  @field(t.state(() => CounterStateFacade))
  counter!: CounterStateFacade;

  setCounterValue(value: number) {
    this.counter.value = value;
  }

  incrementCounter(amount: number) {
    this.counter.increment(amount);
  }

  hasCounterValueAtLeast(minimum: number) {
    return this.counter.value >= minimum;
  }
}

@State()
class DefaultChildState {
  @field(t.number())
  count = 2;
}

@State()
class DefaultRootState {
  @field(t.array(t.string()))
  names = ["alpha"];

  @field(t.optional(t.string()))
  label?: string;

  @field(t.state(() => DefaultChildState))
  child!: DefaultChildState;
}

@State()
class ExplicitNestedDefaultRootState {
  @field(t.state(() => DefaultChildState))
  child = Object.assign(new DefaultChildState(), { count: 5 });
}

@State()
class MissingRequiredDefaultRootState {
  @field(t.array(t.string()))
  names!: string[];
}

@State()
class NullNestedDefaultRootState {
  @field(t.state(() => DefaultChildState))
  child: DefaultChildState | null = null;
}

@State()
class OptionalNestedDefaultRootState {
  @field(t.optional(t.state(() => DefaultChildState)))
  child?: DefaultChildState;
}

@OwnedByPlayer()
@State()
class VisiblePlayerState {
  @field(t.string())
  id = "";

  @visibleToSelf()
  @field(t.array(t.string()))
  hand: string[] = [];

  @field(t.number())
  score = 0;
}

const hiddenSummarySchema = t.object({
  count: t.number(),
});

@OwnedByPlayer()
@State()
class VisibleSummaryPlayerState {
  @field(t.string())
  id = "";

  @visibleToSelf({
    schema: hiddenSummarySchema,
    project(value) {
      return {
        count: Array.isArray(value) ? value.length : 0,
      };
    },
  })
  @field(t.array(t.string()))
  hand: string[] = [];

  @field(t.number())
  score = 0;
}

@State()
class VisibleSummaryRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => VisibleSummaryPlayerState),
    ),
  )
  players: Record<string, VisibleSummaryPlayerState> = {};

  replacePlayers(players: Record<string, VisibleSummaryPlayerState>) {
    this.players = players;
  }
}

@State()
class VisibleRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => VisiblePlayerState),
    ),
  )
  players: Record<string, VisiblePlayerState> = {};

  replacePlayers(players: Record<string, VisiblePlayerState>) {
    this.players = players;
  }
}

@State()
class HiddenDeckState {
  @hidden()
  @field(t.array(t.string()))
  cards: string[] = [];

  setCards(cards: string[]) {
    this.cards = cards;
  }
}

@State()
class HiddenSummaryDeckState {
  @hidden({
    schema: hiddenSummarySchema,
    project(value) {
      return {
        count: Array.isArray(value) ? value.length : 0,
      };
    },
  })
  @field(t.array(t.string()))
  cards: string[] = [];

  setCards(cards: string[]) {
    this.cards = cards;
  }
}

@State()
class HiddenSummaryDeckRootState {
  @field(t.state(() => HiddenSummaryDeckState))
  deck!: HiddenSummaryDeckState;

  setDeckCards(cards: string[]) {
    this.deck.setCards(cards);
  }
}

@State()
class HiddenDeckRootState {
  @field(t.state(() => HiddenDeckState))
  deck!: HiddenDeckState;

  setDeckCards(cards: string[]) {
    this.deck.setCards(cards);
  }
}

@State()
class CustomVisibleDeckState {
  @hidden()
  @field(t.array(t.string()))
  cards: string[] = [];

  setCards(cards: string[]) {
    this.cards = cards;
  }

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

  setDeckCards(cards: string[]) {
    this.deck.setCards(cards);
  }
}

@State()
class PlainCounterRootState {
  @field(t.number())
  counter = 0;

  incrementCounter(amount = 1) {
    this.counter += amount;
  }

  decrementCounter(amount = 1) {
    this.counter -= amount;
  }
}

@State()
class CanPlayRootState {
  @field(t.boolean())
  canPlay = true;
}

@State()
class EnergyRootState {
  @field(t.number())
  energy = 1;

  spendEnergy(amount = 1) {
    this.energy -= amount;
  }
}

@State()
class NumericActionsRootState {
  @field(t.number())
  actions = 0;

  @field(t.number())
  cleaned = 0;

  recordAction(amount = 1) {
    this.actions += amount;
  }

  recordCleanup(amount = 1) {
    this.cleaned += amount;
  }
}

@State()
class StringActionsRootState {
  @field(t.array(t.string()))
  actions: string[] = [];

  recordAction(value: string) {
    this.actions.push(value);
  }
}

test("createGameExecutor hydrates decorated state facades for execution", () => {
  const defineCommand = createCommandFactory<RootCounterStateFacade>();
  const commands = {
    increment_counter: defineCommand({
      commandId: "increment_counter",
      commandSchema: amountCommandSchema,
    })
      .validate(() => ({ ok: true as const }))
      .execute(({ game, command }) => {
        const amount =
          typeof command.input.amount === "number" ? command.input.amount : 1;

        (game as RootCounterStateFacade).incrementCounter(amount);
      })
      .build(),
  };
  const game = new GameDefinitionBuilder<{
    counter: {
      value: number;
    };
  }>("facade-counter-game")
    .rootState(RootCounterStateFacade)
    .initialStage(createSelfLoopingTurnStage(Object.values(commands)))
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();
  const result = executor.executeCommand(initialState, {
    type: "increment_counter",
    actorId: "player-1",
    input: {
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
    .setup(({ game }) => {
      game.setCounterValue(2);
    })
    .initialStage(createTerminalStage())
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

test("createInitialState synthesizes canonical game state from rootState defaults", () => {
  const game = new GameDefinitionBuilder("default-root-state-game")
    .rootState(DefaultRootState)
    .initialStage(createTerminalStage())
    .build();

  const executor = createGameExecutor(game);
  const state = executor.createInitialState();

  expect(state.game).toEqual({
    names: ["alpha"],
    label: undefined,
    child: {
      count: 2,
    },
  });
});

test("createInitialState respects explicit nested state initializers", () => {
  const game = new GameDefinitionBuilder("explicit-nested-root-state-game")
    .rootState(ExplicitNestedDefaultRootState)
    .initialStage(createTerminalStage())
    .build();

  const executor = createGameExecutor(game);
  const state = executor.createInitialState();

  expect(state.game).toEqual({
    child: {
      count: 5,
    },
  });
});

test("createInitialState leaves missing optional nested state fields undefined", () => {
  const game = new GameDefinitionBuilder("optional-nested-root-state-game")
    .rootState(OptionalNestedDefaultRootState)
    .initialStage(createTerminalStage())
    .build();

  const executor = createGameExecutor(game);
  const state = executor.createInitialState();

  expect(state.game).toEqual({
    child: undefined,
  });
});

test("GameDefinitionBuilder fails when a required non-optional field has no default", () => {
  expect(() =>
    new GameDefinitionBuilder("missing-required-root-state-game")
      .rootState(MissingRequiredDefaultRootState)
      .initialStage(createTerminalStage())
      .build(),
  ).toThrow();
});

test("GameDefinitionBuilder fails when a non-optional nested state defaults to null", () => {
  expect(() =>
    new GameDefinitionBuilder("null-nested-root-state-game")
      .rootState(NullNestedDefaultRootState)
      .initialStage(createTerminalStage())
      .build(),
  ).toThrow();
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
    .setup(({ game }) => {
      game.replacePlayers({
        p1: {
          id: "p1",
          hand: ["a", "b"],
          score: 3,
        } as VisiblePlayerState,
        p2: {
          id: "p2",
          hand: ["x"],
          score: 2,
        } as VisiblePlayerState,
      });
    })
    .initialStage(createTerminalStage())
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
    .setup(({ game }) => {
      game.setDeckCards(["a", "b", "c"]);
    })
    .initialStage(createTerminalStage())
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

test("createGameExecutor projects hidden summary values for hidden fields", () => {
  const game = new GameDefinitionBuilder<{
    deck: {
      cards: string[];
    };
  }>("hidden-summary-deck-game")
    .rootState(HiddenSummaryDeckRootState)
    .setup(({ game }) => {
      game.setDeckCards(["a", "b", "c"]);
    })
    .initialStage(createTerminalStage())
    .build();

  const executor = createGameExecutor(game) as {
    createInitialState(): unknown;
    getView(
      state: unknown,
      viewer: { kind: "spectator" } | { kind: "player"; playerId: string },
    ): {
      game: {
        deck: {
          cards: { __hidden: true; value?: { count: number } };
        };
      };
    };
  };
  const state = executor.createInitialState();
  const visibleForPlayer = executor.getView(state, {
    kind: "player",
    playerId: "p1",
  });

  expect(visibleForPlayer.game.deck.cards).toEqual({
    __hidden: true,
    value: {
      count: 3,
    },
  });
});

test("createGameExecutor projects hidden summary values for visibleToSelf fields", () => {
  const game = new GameDefinitionBuilder<{
    players: Record<
      string,
      {
        id: string;
        hand: string[];
        score: number;
      }
    >;
  }>("private-hand-summary-game")
    .rootState(VisibleSummaryRootState)
    .setup(({ game }) => {
      game.replacePlayers({
        p1: {
          id: "p1",
          hand: ["a", "b"],
          score: 3,
        } as VisibleSummaryPlayerState,
        p2: {
          id: "p2",
          hand: ["x"],
          score: 2,
        } as VisibleSummaryPlayerState,
      });
    })
    .initialStage(createTerminalStage())
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
            hand: string[] | { __hidden: true; value?: { count: number } };
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
  const visibleForP2 = executor.getView(state, {
    kind: "player",
    playerId: "p2",
  });

  expect(visibleForP1.game.players.p1?.hand).toEqual(["a", "b"]);
  expect(visibleForP1.game.players.p2?.hand).toEqual({
    __hidden: true,
    value: {
      count: 1,
    },
  });
  expect(visibleForP2.game.players.p1?.hand).toEqual({
    __hidden: true,
    value: {
      count: 2,
    },
  });
});

test("createGameExecutor lets a state override its visible projection shape", () => {
  const game = new GameDefinitionBuilder<{
    deck: {
      cards: string[];
    };
  }>("custom-visible-deck-game")
    .rootState(CustomVisibleDeckRootState)
    .setup(({ game }) => {
      game.setDeckCards(["a", "b", "c"]);
    })
    .initialStage(createTerminalStage())
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
    .setup(({ game }) => {
      game.replacePlayers({
        p1: {
          id: "",
          hand: ["a", "b"],
          score: 3,
        } as VisiblePlayerState,
      });
    })
    .initialStage(createTerminalStage())
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
  const defineCommand = createCommandFactory<RootCounterStateFacade>();
  const commands = {
    increment_counter: defineCommand({
      commandId: "increment_counter",
      commandSchema: amountCommandSchema,
    })
      .discoverable({
        discoverySchema: amountCommandSchema,
        discover: ({ game }) => {
          if ((game as RootCounterStateFacade).hasCounterValueAtLeast(2)) {
            return {
              complete: false as const,
              step: "select_amount",
              options: [{ id: "two", nextInput: { amount: 2 } }],
            };
          }

          return {
            complete: false as const,
            step: "select_amount",
            options: [{ id: "one", nextInput: { amount: 1 } }],
          };
        },
      })
      .isAvailable(({ game }) =>
        (game as RootCounterStateFacade).hasCounterValueAtLeast(1),
      )
      .validate(() => ({ ok: true as const }))
      .execute(({ game, command }) => {
        const amount =
          typeof command.input.amount === "number" ? command.input.amount : 1;

        (game as RootCounterStateFacade).incrementCounter(amount);
      })
      .build(),
  };
  const game = new GameDefinitionBuilder<{
    counter: {
      value: number;
    };
  }>("readonly-facade-discovery-game")
    .rootState(RootCounterStateFacade)
    .setup(({ game }) => {
      game.setCounterValue(2);
    })
    .initialStage(createSelfLoopingTurnStage(Object.values(commands)))
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();

  expect(
    executor.listAvailableCommands(initialState, { actorId: "player-1" }),
  ).toEqual(["increment_counter"]);
  expect(
    executor.discoverCommand(initialState, {
      type: "increment_counter",
      actorId: "player-1",
      input: {},
    }),
  ).toMatchObject({
    complete: false,
    step: "select_amount",
    options: [{ id: "two", nextInput: { amount: 2 } }],
  });
  expect(initialState.game.counter.value).toBe(2);
});

test("readonly decorated facades reject mutation during validation", () => {
  const defineCommand = createCommandFactory<RootCounterStateFacade>();
  const commands = {
    increment_counter: defineCommand({
      commandId: "increment_counter",
      commandSchema: emptyCommandSchema,
    })
      .validate(({ game }) => {
        (game as RootCounterStateFacade).incrementCounter(1);
        return { ok: true as const };
      })
      .execute(() => {})
      .build(),
  };
  const game = new GameDefinitionBuilder<{
    counter: {
      value: number;
    };
  }>("readonly-facade-validation-game")
    .rootState(RootCounterStateFacade)
    .initialStage(createSelfLoopingTurnStage(Object.values(commands)))
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();

  expect(() =>
    executor.executeCommand(initialState, {
      type: "increment_counter",
      actorId: "player-1",
      input: {},
    }),
  ).toThrow("readonly_state_facade_mutation:value");
  expect(initialState.game.counter.value).toBe(0);
});

test("createGameExecutor creates initial state and commits successful commands", () => {
  const defineCommand = createCommandFactory<PlainCounterRootState>();
  const commands = {
    increment_counter: defineCommand({
      commandId: "increment_counter",
      commandSchema: amountCommandSchema,
    })
      .validate(() => ({ ok: true as const }))
      .execute(({ game, command, emitEvent }) => {
        const amount =
          typeof command.input.amount === "number" ? command.input.amount : 1;

        game.incrementCounter(amount);
        emitEvent({
          category: "domain",
          type: "counter_incremented",
          payload: { amount },
        });
      })
      .build(),
    decrement_counter: defineCommand({
      commandId: "decrement_counter",
      commandSchema: emptyCommandSchema,
    })
      .validate(({ game }) =>
        game.counter > 0
          ? { ok: true as const }
          : {
              ok: false as const,
              reason: "counter_is_zero",
            },
      )
      .execute(({ game }) => {
        game.decrementCounter();
      })
      .build(),
  };
  const game = new GameDefinitionBuilder("counter-game")
    .rootState(PlainCounterRootState)
    .initialStage(createSelfLoopingTurnStage(Object.values(commands)))
    .rngSeed("test-seed")
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const success = gameExecutor.executeCommand(initialState, {
    type: "increment_counter",
    actorId: "player-1",
    input: { amount: 2 },
  });

  expect(initialState.game.counter).toBe(0);
  expect(initialState.runtime.rng.seed).toBe("test-seed");
  expect(success.ok).toBe(true);
  expect(success.state.game.counter).toBe(2);
  expect(success.events).toHaveLength(3);
  expect(success.events[0]?.type).toBe("counter_incremented");
});

test("createGameExecutor returns unchanged state for validation failures", () => {
  const defineCommand = createCommandFactory<PlainCounterRootState>();
  const commands = {
    decrement_counter: defineCommand({
      commandId: "decrement_counter",
      commandSchema: emptyCommandSchema,
    })
      .validate(({ game }) =>
        game.counter > 0
          ? { ok: true as const }
          : {
              ok: false as const,
              reason: "counter_is_zero",
              metadata: { minimum: 1 },
            },
      )
      .execute(({ game }) => {
        game.decrementCounter();
      })
      .build(),
  };
  const game = new GameDefinitionBuilder("counter-game")
    .rootState(PlainCounterRootState)
    .initialStage(createSelfLoopingTurnStage(Object.values(commands)))
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const failure = gameExecutor.executeCommand(initialState, {
    type: "decrement_counter",
    actorId: "player-1",
    input: {},
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

test("createGameExecutor rejects commands missing actorId at runtime", () => {
  const defineCommand = createCommandFactory<PlainCounterRootState>();
  const commands = {
    increment_counter: defineCommand({
      commandId: "increment_counter",
      commandSchema: emptyCommandSchema,
    })
      .validate(() => ({ ok: true as const }))
      .execute(({ game }) => {
        game.incrementCounter();
      })
      .build(),
  };
  const game = new GameDefinitionBuilder("missing-actor-game")
    .rootState(PlainCounterRootState)
    .initialStage(createSelfLoopingTurnStage(Object.values(commands)))
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();
  const result = executor.executeCommand(initialState, {
    type: "increment_counter",
    input: {},
  } as never);

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("expected missing actorId failure");
  }

  expect(result.reason).toBe("missing_actor_id");
});

test("createGameExecutor rejects commands missing input at runtime", () => {
  const defineCommand = createCommandFactory<PlainCounterRootState>();
  const commands = {
    increment_counter: defineCommand({
      commandId: "increment_counter",
      commandSchema: emptyCommandSchema,
    })
      .validate(() => ({ ok: true as const }))
      .execute(({ game }) => {
        game.incrementCounter();
      })
      .build(),
  };
  const game = new GameDefinitionBuilder("missing-input-game")
    .rootState(PlainCounterRootState)
    .initialStage(createSelfLoopingTurnStage(Object.values(commands)))
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();
  const result = executor.executeCommand(initialState, {
    type: "increment_counter",
    actorId: "player-1",
  } as never);

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("expected missing input failure");
  }

  expect(result.reason).toBe("missing_command_input");
});

test("createGameExecutor rejects discovery missing input at runtime", () => {
  const defineCommand = createCommandFactory<CanPlayRootState>();
  const commands = {
    play_card: defineCommand({
      commandId: "play_card",
      commandSchema: playCardCommandSchema,
    })
      .discoverable({
        discoverySchema: t.object({
          cardId: t.optional(t.number()),
        }),
        discover() {
          return null;
        },
      })
      .validate(() => ({ ok: true as const }))
      .execute(() => {})
      .build(),
  };
  const game = new GameDefinitionBuilder("missing-discovery-input-game")
    .rootState(CanPlayRootState)
    .initialStage(createSelfLoopingTurnStage(Object.values(commands)))
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();
  const result = executor.discoverCommand(initialState, {
    type: "play_card",
    actorId: "player-1",
  } as never);

  expect(result).toBeNull();
});

test("initial automatic stages run before the initial state is returned", () => {
  const defineStage = createStageFactory<RootCounterStateFacade>();
  const gameEndStage = defineStage("gameEnd").automatic().build();
  const bootstrapStage = defineStage("bootstrap")
    .automatic()
    .run(({ game }) => {
      game.incrementCounter(2);
    })
    .nextStages(() => ({
      gameEndStage,
    }))
    .transition(({ nextStages }) => nextStages.gameEndStage)
    .build();

  const game = new GameDefinitionBuilder("bootstrap-stage-game")
    .rootState(RootCounterStateFacade)
    .initialStage(bootstrapStage)
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();

  expect(initialState.game.counter.value).toBe(2);
  expect(initialState.runtime.progression.currentStage).toEqual({
    id: "gameEnd",
    kind: "automatic",
  });
  expect(initialState.runtime.progression.lastActingStage).toBeNull();
});

test("single-active stages reject commands from inactive players", () => {
  const defineCommand = createCommandFactory<NumericActionsRootState>();
  const defineStage = createStageFactory<NumericActionsRootState>();
  const takeActionCommand = defineCommand({
    commandId: "take_action",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game }) => {
      game.recordAction();
    })
    .build();
  const playerTurnStage = createPlayerTurnStage();

  function createPlayerTurnStage(): SingleActivePlayerStageDefinition<NumericActionsRootState> {
    return defineStage("playerTurn")
      .singleActivePlayer()
      .activePlayer(() => "player-1")
      .commands([takeActionCommand])
      .nextStages(() => ({ playerTurnStage }))
      .transition(({ nextStages }) => nextStages.playerTurnStage)
      .build();
  }

  const game = new GameDefinitionBuilder("inactive-player-stage-game")
    .rootState(NumericActionsRootState)
    .initialStage(playerTurnStage)
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();
  const result = executor.executeCommand(initialState, {
    type: "take_action",
    actorId: "player-2",
    input: {},
  });

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("expected inactive-player rejection");
  }

  expect(result.reason).toBe("not_active_player");
});

test("multi-active stages stay active until completion and recompute active players from memory", () => {
  const defineCommand = createCommandFactory<StringActionsRootState>();
  const defineStage = createStageFactory<StringActionsRootState>();
  const submitActionCommand = defineCommand({
    commandId: "submit_action",
    commandSchema: t.object({
      value: t.string(),
    }),
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game, command }) => {
      game.recordAction(command.input.value);
    })
    .build();
  const gameEndStage = defineStage("gameEnd").automatic().build();
  const coordinatedStage = defineStage("coordinatedStage")
    .multiActivePlayer()
    .memory(
      t.object({
        submittedByPlayerId: t.record(t.string(), t.string()),
      }),
      () => ({
        submittedByPlayerId: {} as Record<string, string>,
      }),
    )
    .activePlayers(({ memory }) => {
      return ["player-1", "player-2"].filter((playerId) => {
        return memory.submittedByPlayerId[playerId] === undefined;
      });
    })
    .commands([submitActionCommand])
    .onSubmit(({ command, execute, memory }) => {
      memory.submittedByPlayerId[command.actorId] = command.input.value;
      execute(command);
    })
    .isComplete(({ memory }) => {
      return Object.keys(memory.submittedByPlayerId).length === 2;
    })
    .nextStages(() => ({
      gameEndStage,
    }))
    .transition(({ nextStages, memory }) => {
      expect(memory.submittedByPlayerId).toEqual({
        "player-1": "first",
        "player-2": "second",
      });
      return nextStages.gameEndStage;
    })
    .build();

  const game = new GameDefinitionBuilder("multi-active-game")
    .rootState(StringActionsRootState)
    .initialStage(coordinatedStage)
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();

  expect(initialState.runtime.progression.currentStage).toEqual({
    id: "coordinatedStage",
    kind: "multiActivePlayer",
    activePlayerIds: ["player-1", "player-2"],
    memory: {
      submittedByPlayerId: {},
    },
  });

  const afterFirstSubmission = executor.executeCommand(initialState, {
    type: "submit_action",
    actorId: "player-1",
    input: {
      value: "first",
    },
  });

  expect(afterFirstSubmission.ok).toBe(true);

  if (!afterFirstSubmission.ok) {
    throw new Error("expected first multi-active submission to succeed");
  }

  expect(afterFirstSubmission.state.game.actions).toEqual(["first"]);
  expect(afterFirstSubmission.state.runtime.progression.currentStage).toEqual({
    id: "coordinatedStage",
    kind: "multiActivePlayer",
    activePlayerIds: ["player-2"],
    memory: {
      submittedByPlayerId: {
        "player-1": "first",
      },
    },
  });

  const inactiveResult = executor.executeCommand(afterFirstSubmission.state, {
    type: "submit_action",
    actorId: "player-1",
    input: {
      value: "duplicate",
    },
  });

  expect(inactiveResult.ok).toBe(false);

  if (inactiveResult.ok) {
    throw new Error("expected inactive multi-active submission rejection");
  }

  expect(inactiveResult.reason).toBe("not_active_player");

  const afterSecondSubmission = executor.executeCommand(
    afterFirstSubmission.state,
    {
      type: "submit_action",
      actorId: "player-2",
      input: {
        value: "second",
      },
    },
  );

  expect(afterSecondSubmission.ok).toBe(true);

  if (!afterSecondSubmission.ok) {
    throw new Error("expected second multi-active submission to succeed");
  }

  expect(afterSecondSubmission.state.game.actions).toEqual(["first", "second"]);
  expect(afterSecondSubmission.state.runtime.progression.currentStage).toEqual({
    id: "gameEnd",
    kind: "automatic",
  });
  expect(
    afterSecondSubmission.state.runtime.progression.lastActingStage,
  ).toEqual({
    id: "coordinatedStage",
    kind: "multiActivePlayer",
    activePlayerIds: [],
    memory: {
      submittedByPlayerId: {
        "player-1": "first",
        "player-2": "second",
      },
    },
  });
});

test("successful stage-machine commands transition through automatic stages and emit stage events", () => {
  const defineCommand = createCommandFactory<NumericActionsRootState>();
  const defineStage = createStageFactory<NumericActionsRootState>();
  const takeActionCommand = defineCommand({
    commandId: "take_action",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game, emitEvent }) => {
      game.recordAction();
      emitEvent({
        category: "domain",
        type: "action_taken",
        payload: { amount: 1 },
      });
    })
    .build();
  const gameEndStage = defineStage("gameEnd").automatic().build();
  const cleanupStage = defineStage("cleanup")
    .automatic()
    .run(({ game, emitEvent }) => {
      game.recordCleanup();
      emitEvent({
        category: "runtime",
        type: "cleanup_ran",
        payload: { cleaned: game.cleaned },
      });
    })
    .nextStages(() => ({
      gameEndStage,
    }))
    .transition(({ nextStages }) => nextStages.gameEndStage)
    .build();
  const playerTurnStage = defineStage("playerTurn")
    .singleActivePlayer()
    .activePlayer(() => "player-1")
    .commands([takeActionCommand])
    .nextStages(() => ({
      cleanupStage,
    }))
    .transition(({ nextStages }) => nextStages.cleanupStage)
    .build();

  const game = new GameDefinitionBuilder("stage-transition-game")
    .rootState(NumericActionsRootState)
    .initialStage(playerTurnStage)
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();
  const result = executor.executeCommand(initialState, {
    type: "take_action",
    actorId: "player-1",
    input: {},
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("expected stage-machine transition");
  }

  expect(result.state.game).toMatchObject({
    actions: 1,
    cleaned: 1,
  });
  expect(result.state.runtime.progression.currentStage).toEqual({
    id: "gameEnd",
    kind: "automatic",
  });
  expect(result.state.runtime.progression.lastActingStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "player-1",
  });
  expect(result.events.map((event) => event.type)).toEqual([
    "action_taken",
    "stage_exited",
    "stage_entered",
    "cleanup_ran",
    "stage_exited",
    "stage_entered",
  ]);
  expect(result.events[2]).toMatchObject({
    category: "runtime",
    type: "stage_entered",
    payload: {
      stageId: "cleanup",
      kind: "automatic",
    },
  });
  expect(result.events[5]).toMatchObject({
    category: "runtime",
    type: "stage_entered",
    payload: {
      stageId: "gameEnd",
      kind: "automatic",
    },
  });
});

test("automatic stages hydrate decorated state facades during run", () => {
  const defineStage = createStageFactory<RootCounterStateFacade>();
  const gameEndStage = defineStage("gameEnd").automatic().build();
  const cleanupStage = defineStage("cleanup")
    .automatic()
    .run(({ game }) => {
      game.incrementCounter(3);
    })
    .nextStages(() => ({
      gameEndStage,
    }))
    .transition(({ nextStages }) => nextStages.gameEndStage)
    .build();

  const game = new GameDefinitionBuilder("automatic-facade-game")
    .rootState(RootCounterStateFacade)
    .initialStage(cleanupStage)
    .build();

  const executor = createGameExecutor(game);
  const initialState = executor.createInitialState();

  expect(initialState.game.counter.value).toBe(3);
  expect(initialState.runtime.progression.currentStage).toEqual({
    id: "gameEnd",
    kind: "automatic",
  });
  expect(initialState.runtime.progression.lastActingStage).toBeNull();
});

test("game executor can list available commands through per-command availability hooks", () => {
  const defineCommand = createCommandFactory<EnergyRootState>();
  const commands = {
    pass_turn: defineCommand({
      commandId: "pass_turn",
      commandSchema: emptyCommandSchema,
    })
      .isAvailable(() => true)
      .validate(() => ({ ok: true as const }))
      .execute(() => {})
      .build(),
    spend_energy: defineCommand({
      commandId: "spend_energy",
      commandSchema: emptyCommandSchema,
    })
      .isAvailable(({ game }) => game.energy > 0)
      .validate(({ game }) =>
        game.energy > 0
          ? { ok: true as const }
          : { ok: false as const, reason: "no_energy" },
      )
      .execute(({ game }) => {
        game.spendEnergy();
      })
      .build(),
    impossible_action: defineCommand({
      commandId: "impossible_action",
      commandSchema: emptyCommandSchema,
    })
      .isAvailable(() => false)
      .validate(() => ({ ok: true as const }))
      .execute(() => {})
      .build(),
  };
  const game = new GameDefinitionBuilder("availability-game")
    .rootState(EnergyRootState)
    .initialStage(createSelfLoopingTurnStage(Object.values(commands)))
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();

  expect(
    gameExecutor.listAvailableCommands(initialState, { actorId: "player-1" }),
  ).toEqual(["pass_turn", "spend_energy"]);

  const nextState = gameExecutor.executeCommand(initialState, {
    type: "spend_energy",
    actorId: "player-1",
    input: {},
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
  const defineCommand = createCommandFactory<CanPlayRootState>();
  const commands = {
    play_card: defineCommand({
      commandId: "play_card",
      commandSchema: playCardCommandSchema,
    })
      .discoverable({
        discoverySchema: t.object({
          cardId: t.optional(t.number()),
          targetId: t.optional(t.number()),
        }),
        discover: ({ discovery }) => {
          const cardId = discovery.input.cardId;

          if (typeof cardId !== "number") {
            return {
              complete: false as const,
              step: "select_card",
              options: [
                { id: "card-1", nextInput: { cardId: 1 } },
                { id: "card-2", nextInput: { cardId: 2 } },
              ],
            };
          }

          return {
            complete: false as const,
            step: "select_target",
            options: [{ id: "target-1", nextInput: { cardId, targetId: 101 } }],
          };
        },
      })
      .isAvailable(({ game }) => game.canPlay)
      .validate(() => ({ ok: true as const }))
      .execute(() => {})
      .build(),
  };
  const game = new GameDefinitionBuilder("discovery-game")
    .rootState(CanPlayRootState)
    .initialStage(createSelfLoopingTurnStage(Object.values(commands)))
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const firstStep = gameExecutor.discoverCommand(initialState, {
    type: "play_card",
    actorId: "player-1",
    input: {},
  });
  const secondStep = gameExecutor.discoverCommand(initialState, {
    type: "play_card",
    actorId: "player-1",
    input: {
      cardId: 2,
    },
  });

  expect(firstStep).toMatchObject({
    complete: false,
    step: "select_card",
  });
  if (!firstStep || firstStep.complete) {
    throw new Error("expected_incomplete_discovery");
  }
  expect(firstStep.options).toHaveLength(2);
  expect(secondStep).toMatchObject({
    complete: false,
    step: "select_target",
  });
  if (!secondStep || secondStep.complete) {
    throw new Error("expected_incomplete_discovery");
  }
  expect(secondStep.options[0]).toEqual({
    id: "target-1",
    nextInput: { cardId: 2, targetId: 101 },
  });
});
