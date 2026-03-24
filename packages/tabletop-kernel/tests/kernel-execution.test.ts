import { expect, test } from "bun:test";
import { createKernel } from "../src/kernel/create-kernel";
import { defineGame } from "../src/game-definition";
import { evaluateCompletionPolicy } from "../src/kernel/progression-lifecycle";
import {
  createProgressionCompletionContext,
  createProgressionLifecycleHookContext,
} from "../src/kernel/contexts";
import { createEventCollector } from "../src/kernel/events";
import { createRNGService } from "../src/rng/service";

test("createKernel creates initial state and commits successful commands", () => {
  const game = defineGame({
    name: "counter-game",
    initialState: () => ({
      counter: 0,
    }),
    commands: {
      increment_counter: {
        validate: () => ({ ok: true as const }),
        execute: ({ game, command, emitEvent }) => {
          const amount =
            typeof command.payload?.amount === "number"
              ? command.payload.amount
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
    },
    rngSeed: "test-seed",
  });

  const kernel = createKernel(game);
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

test("createKernel returns unchanged state for validation failures", () => {
  const game = defineGame({
    name: "counter-game",
    initialState: () => ({
      counter: 0,
    }),
    commands: {
      decrement_counter: {
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
    },
  });

  const kernel = createKernel(game);
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
  const game = defineGame({
    name: "turn-game",
    initialState: () => ({
      marker: 0,
    }),
    progression: {
      root: {
        id: "turn",
        kind: "turn",
        children: [],
      },
    },
    setup: ({ runtime }) => {
      runtime.progression.segments.turn!.ownerId = "player-1";
    },
    commands: {
      pass_turn: {
        validate: () => ({ ok: true as const }),
        execute: ({ setCurrentSegmentOwner }) => {
          setCurrentSegmentOwner("player-2");
        },
      },
    },
  });

  const kernel = createKernel(game);
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
  const command = {
    type: "take_action",
    actorId: "player-1",
  };
  const completionContext = createProgressionCompletionContext(
    state,
    command,
    state.runtime.progression.segments.turn!,
  );
  const collector = createEventCollector();
  const lifecycleContext = createProgressionLifecycleHookContext(
    state,
    command,
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
