import { expect, test } from "bun:test";
import { createGameExecutor } from "../src/kernel/create-kernel";
import { GameDefinitionBuilder } from "../src/game-definition";
import { evaluateCompletionPolicy } from "../src/kernel/progression-lifecycle";
import {
  createProgressionCompletionContext,
  createProgressionLifecycleHookContext,
} from "../src/kernel/contexts";
import { createEventCollector } from "../src/kernel/events";
import { createRNGService } from "../src/rng/service";

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
        validate: ({ state }) =>
          state.game.counter > 0
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

  const kernel = createGameExecutor(game);
  const initialState = kernel.createInitialState();
  const success = kernel.executeCommand(initialState, {
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
        validate: ({ state }) =>
          state.game.counter > 0
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

  const kernel = createGameExecutor(game);
  const initialState = kernel.createInitialState();
  const failure = kernel.executeCommand(initialState, {
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
        validate: () => ({ ok: true as const }),
        execute: ({ setCurrentSegmentOwner }) => {
          setCurrentSegmentOwner("player-2");
        },
      },
    })
    .build();

  const kernel = createGameExecutor(game);
  const initialState = kernel.createInitialState();
  const result = kernel.executeCommand(initialState, {
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
      pending: {
        choices: [],
      },
    },
  };
  const commandInput = {
    type: "take_action",
    actorId: "player-1",
  };
  const completionContext = createProgressionCompletionContext(
    state,
    commandInput,
    state.runtime.progression.segments.turn!,
  );
  const collector = createEventCollector();
  const lifecycleContext = createProgressionLifecycleHookContext(
    state,
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

  const kernel = createGameExecutor(game);
  const initialState = kernel.createInitialState();
  const result = kernel.executeCommand(initialState, {
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
        validate: () => ({ ok: true as const }),
        execute: ({ game }) => {
          game.resolved += 1;
        },
      },
    })
    .build();

  const kernel = createGameExecutor(game);
  const initialState = kernel.createInitialState();
  const result = kernel.executeCommand(initialState, {
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
        validate: () => ({ ok: true as const }),
        execute: ({ game }) => {
          game.actions += 1;
        },
      },
      end_turn: {
        commandId: "end_turn",
        validate: () => ({ ok: true as const }),
        execute: ({ game }) => {
          game.requestedTurnEnd = true;
        },
      },
    })
    .build();

  const kernel = createGameExecutor(game);
  const initialState = kernel.createInitialState();
  const actionResult = kernel.executeCommand(initialState, {
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

  const endTurnResult = kernel.executeCommand(actionResult.state, {
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
        isAvailable: () => true,
        validate: () => ({ ok: true as const }),
        execute: () => {},
      },
      spend_energy: {
        commandId: "spend_energy",
        isAvailable: ({ state }) => state.game.energy > 0,
        validate: ({ state }) =>
          state.game.energy > 0
            ? { ok: true as const }
            : { ok: false as const, reason: "no_energy" },
        execute: ({ game }) => {
          game.energy -= 1;
        },
      },
      impossible_action: {
        commandId: "impossible_action",
        isAvailable: () => false,
        validate: () => ({ ok: true as const }),
        execute: () => {},
      },
    })
    .build();

  const kernel = createGameExecutor(game);
  const initialState = kernel.createInitialState();

  expect(
    kernel.listAvailableCommands(initialState, { actorId: "player-1" }),
  ).toEqual(["pass_turn", "spend_energy"]);

  const nextState = kernel.executeCommand(initialState, {
    type: "spend_energy",
    actorId: "player-1",
  });

  expect(nextState.ok).toBe(true);

  if (!nextState.ok) {
    throw new Error("expected spending energy to succeed");
  }

  expect(
    kernel.listAvailableCommands(nextState.state, { actorId: "player-1" }),
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
        isAvailable: ({ state }) => state.game.canPlay,
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

  const kernel = createGameExecutor(game);
  const initialState = kernel.createInitialState();
  const firstStep = kernel.discoverCommand(initialState, {
    type: "play_card",
    actorId: "player-1",
  });
  const secondStep = kernel.discoverCommand(initialState, {
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
