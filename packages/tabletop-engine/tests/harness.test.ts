import { expect, test } from "bun:test";
import {
  createCommandFactory,
  createGameExecutor,
  GameDefinitionBuilder,
  runScenario,
  t,
} from "../src/index";
import { createSelfLoopingTurnStage } from "./helpers/stages";

test("runScenario applies commands in order and returns per-command results", () => {
  const defineCommand = createCommandFactory<{
    counter: number;
  }>();
  const incrementCommandSchema = t.object({
    amount: t.optional(t.number()),
  });
  const incrementCounterCommand = defineCommand({
    commandId: "increment_counter",
    commandSchema: incrementCommandSchema,
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game, command }) => {
      const amount =
        typeof command.input.amount === "number" ? command.input.amount : 1;

      game.counter += amount;
    })
    .build();

  const game = new GameDefinitionBuilder<{
    counter: number;
  }>("counter-game")
    .initialState(() => ({
      counter: 0,
    }))
    .initialStage(createSelfLoopingTurnStage([incrementCounterCommand]))
    .build();

  const gameExecutor = createGameExecutor(game);
  const scenario = runScenario(gameExecutor, [
    { type: "increment_counter", actorId: "player-1", input: { amount: 2 } },
    { type: "increment_counter", actorId: "player-1", input: { amount: 3 } },
  ]);

  expect(scenario.initialState.game.counter).toBe(0);
  expect(scenario.finalState.game.counter).toBe(5);
  expect(scenario.results).toHaveLength(2);
  expect(scenario.results[0]?.ok).toBe(true);
  expect(scenario.results[1]?.ok).toBe(true);
});
