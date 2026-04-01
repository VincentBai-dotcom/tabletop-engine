import { expect, test } from "bun:test";
import {
  createCommandFactory,
  createGameExecutor,
  GameDefinitionBuilder,
  runScenario,
  t,
} from "../src/index";

test("runScenario applies commands in order and returns per-command results", () => {
  const defineCommand = createCommandFactory<{
    counter: number;
  }>();
  const incrementPayload = t.object({
    amount: t.optional(t.number()),
  });

  const game = new GameDefinitionBuilder<{
    counter: number;
  }>("counter-game")
    .initialState(() => ({
      counter: 0,
    }))
    .commands({
      increment_counter: defineCommand({
        commandId: "increment_counter",
        payloadSchema: incrementPayload,
        validate: () => ({ ok: true as const }),
        execute: ({ game, commandInput }) => {
          const amount =
            typeof commandInput.payload?.amount === "number"
              ? commandInput.payload.amount
              : 1;

          game.counter += amount;
        },
      }),
    })
    .build();

  const gameExecutor = createGameExecutor(game);
  const scenario = runScenario(gameExecutor, [
    { type: "increment_counter", payload: { amount: 2 } },
    { type: "increment_counter", payload: { amount: 3 } },
  ]);

  expect(scenario.initialState.game.counter).toBe(0);
  expect(scenario.finalState.game.counter).toBe(5);
  expect(scenario.results).toHaveLength(2);
  expect(scenario.results[0]?.ok).toBe(true);
  expect(scenario.results[1]?.ok).toBe(true);
});
