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

const hiddenSummarySchema = t.object({
  count: t.number(),
});

@OwnedByPlayer()
@State()
class VisibleSummaryPlayerState {
  @field(t.string())
  id!: string;

  @visibleToSelf({
    schema: hiddenSummarySchema,
    project(value) {
      return {
        count: Array.isArray(value) ? value.length : 0,
      };
    },
  })
  @field(t.array(t.string()))
  hand!: string[];

  @field(t.number())
  score!: number;
}

@State()
class VisibleSummaryRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => VisibleSummaryPlayerState),
    ),
  )
  players!: Record<string, VisibleSummaryPlayerState>;
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
  cards!: string[];
}

@State()
class HiddenSummaryDeckRootState {
  @field(t.state(() => HiddenSummaryDeckState))
  deck!: HiddenSummaryDeckState;
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
    .initialState(() => ({
      counter: {
        value: 0,
      },
    }))
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
    .initialState(() => ({
      counter: {
        value: 2,
      },
    }))
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
    .initialState(() => ({
      deck: {
        cards: ["a", "b", "c"],
      },
    }))
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
    .initialState(() => ({
      deck: {
        cards: ["a", "b", "c"],
      },
    }))
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
    .initialState(() => ({
      deck: {
        cards: ["a", "b", "c"],
      },
    }))
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
    .initialState(() => ({
      players: {
        p1: {
          id: "",
          hand: ["a", "b"],
          score: 3,
        },
      },
    }))
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
    .initialState(() => ({
      counter: {
        value: 2,
      },
    }))
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
    .initialState(() => ({
      counter: {
        value: 0,
      },
    }))
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
  const defineCommand = createCommandFactory<{ counter: number }>();
  const commands = {
    increment_counter: defineCommand({
      commandId: "increment_counter",
      commandSchema: amountCommandSchema,
    })
      .validate(() => ({ ok: true as const }))
      .execute(({ game, command, emitEvent }) => {
        const amount =
          typeof command.input.amount === "number" ? command.input.amount : 1;

        game.counter += amount;
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
        game.counter -= 1;
      })
      .build(),
  };
  const game = new GameDefinitionBuilder<{
    counter: number;
  }>("counter-game")
    .initialState(() => ({
      counter: 0,
    }))
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
  const defineCommand = createCommandFactory<{ counter: number }>();
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
        game.counter -= 1;
      })
      .build(),
  };
  const game = new GameDefinitionBuilder<{
    counter: number;
  }>("counter-game")
    .initialState(() => ({
      counter: 0,
    }))
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
  const defineCommand = createCommandFactory<{ counter: number }>();
  const commands = {
    increment_counter: defineCommand({
      commandId: "increment_counter",
      commandSchema: emptyCommandSchema,
    })
      .validate(() => ({ ok: true as const }))
      .execute(({ game }) => {
        game.counter += 1;
      })
      .build(),
  };
  const game = new GameDefinitionBuilder<{
    counter: number;
  }>("missing-actor-game")
    .initialState(() => ({
      counter: 0,
    }))
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
  const defineCommand = createCommandFactory<{ counter: number }>();
  const commands = {
    increment_counter: defineCommand({
      commandId: "increment_counter",
      commandSchema: emptyCommandSchema,
    })
      .validate(() => ({ ok: true as const }))
      .execute(({ game }) => {
        game.counter += 1;
      })
      .build(),
  };
  const game = new GameDefinitionBuilder<{
    counter: number;
  }>("missing-input-game")
    .initialState(() => ({
      counter: 0,
    }))
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
  const defineCommand = createCommandFactory<{ canPlay: boolean }>();
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
  const game = new GameDefinitionBuilder<{
    canPlay: boolean;
  }>("missing-discovery-input-game")
    .initialState(() => ({
      canPlay: true,
    }))
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

  const game = new GameDefinitionBuilder<{
    counter: {
      value: number;
    };
  }>("bootstrap-stage-game")
    .rootState(RootCounterStateFacade)
    .initialState(() => ({
      counter: {
        value: 0,
      },
    }))
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
  const defineCommand = createCommandFactory<{ actions: number }>();
  const defineStage = createStageFactory<{ actions: number }>();
  const takeActionCommand = defineCommand({
    commandId: "take_action",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game }) => {
      game.actions += 1;
    })
    .build();
  const playerTurnStage = createPlayerTurnStage();

  function createPlayerTurnStage(): SingleActivePlayerStageDefinition<{
    actions: number;
  }> {
    return defineStage("playerTurn")
      .singleActivePlayer()
      .activePlayer(() => "player-1")
      .commands([takeActionCommand])
      .nextStages(() => ({ playerTurnStage }))
      .transition(({ nextStages }) => nextStages.playerTurnStage)
      .build();
  }

  const game = new GameDefinitionBuilder<{
    actions: number;
  }>("inactive-player-stage-game")
    .initialState(() => ({
      actions: 0,
    }))
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
  const defineCommand = createCommandFactory<{
    actions: string[];
  }>();
  const defineStage = createStageFactory<{
    actions: string[];
  }>();
  const submitActionCommand = defineCommand({
    commandId: "submit_action",
    commandSchema: t.object({
      value: t.string(),
    }),
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game, command }) => {
      game.actions.push(command.input.value);
    })
    .build();
  const gameEndStage = defineStage("gameEnd").automatic().build();
  const coordinatedStage = defineStage("coordinatedStage")
    .multiActivePlayer()
    .memory<{
      submittedByPlayerId: Record<string, string>;
    }>(() => ({
      submittedByPlayerId: {},
    }))
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

  const game = new GameDefinitionBuilder<{
    actions: string[];
  }>("multi-active-game")
    .initialState(
      (): {
        actions: string[];
      } => ({
        actions: [],
      }),
    )
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
  const defineCommand = createCommandFactory<{
    actions: number;
    cleaned: number;
  }>();
  const defineStage = createStageFactory<{
    actions: number;
    cleaned: number;
  }>();
  const takeActionCommand = defineCommand({
    commandId: "take_action",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game, emitEvent }) => {
      game.actions += 1;
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
      game.cleaned += 1;
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

  const game = new GameDefinitionBuilder<{
    actions: number;
    cleaned: number;
  }>("stage-transition-game")
    .initialState(() => ({
      actions: 0,
      cleaned: 0,
    }))
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

  expect(result.state.game).toEqual({
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

  const game = new GameDefinitionBuilder<{
    counter: {
      value: number;
    };
  }>("automatic-facade-game")
    .rootState(RootCounterStateFacade)
    .initialState(() => ({
      counter: {
        value: 0,
      },
    }))
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
  const defineCommand = createCommandFactory<{ energy: number }>();
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
        game.energy -= 1;
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
  const game = new GameDefinitionBuilder<{
    energy: number;
  }>("availability-game")
    .initialState(() => ({
      energy: 1,
    }))
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
  const defineCommand = createCommandFactory<{
    canPlay: boolean;
  }>();
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
  const game = new GameDefinitionBuilder<{
    canPlay: boolean;
  }>("discovery-game")
    .initialState(() => ({
      canPlay: true,
    }))
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
