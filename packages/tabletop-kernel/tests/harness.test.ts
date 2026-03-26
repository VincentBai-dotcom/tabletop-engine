import { expect, test } from "bun:test";
import {
  createGameExecutor,
  GameDefinitionBuilder,
  runScenario,
} from "../src/index";

test("runScenario applies commands in order and returns per-command results", () => {
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
        execute: ({ game, commandInput }) => {
          const amount =
            typeof commandInput.payload?.amount === "number"
              ? commandInput.payload.amount
              : 1;

          game.counter += amount;
        },
      },
    })
    .build();

  const kernel = createGameExecutor(game);
  const scenario = runScenario(kernel, [
    { type: "increment_counter", payload: { amount: 2 } },
    { type: "increment_counter", payload: { amount: 3 } },
  ]);

  expect(scenario.initialState.game.counter).toBe(0);
  expect(scenario.finalState.game.counter).toBe(5);
  expect(scenario.results).toHaveLength(2);
  expect(scenario.results[0]?.ok).toBe(true);
  expect(scenario.results[1]?.ok).toBe(true);
});
