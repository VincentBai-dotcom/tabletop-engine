import { expect, test } from "bun:test";
import {
  createCommandFactory,
  createGameExecutor,
  GameDefinitionBuilder,
  t,
} from "../src/index";
import { createSelfLoopingTurnStage } from "./helpers/stages";

test("game executor rng is deterministic for the same seed and command sequence", () => {
  const defineCommand = createCommandFactory<{
    roll: number;
    value: number;
    deck: string[];
  }>();
  const emptyCommandSchema = t.object({});
  const sampleRandomnessCommand = defineCommand({
    commandId: "sample_randomness",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game, rng }) => {
      game.value = rng.number();
      game.roll = rng.die(6) as number;
      game.deck = rng.shuffle(game.deck);
    })
    .build();

  const game = new GameDefinitionBuilder<{
    roll: number;
    value: number;
    deck: string[];
  }>("rng-game")
    .initialState(() => ({
      roll: 0,
      value: 0,
      deck: ["a", "b", "c"],
    }))
    .rngSeed("seed-123")
    .initialStage(createSelfLoopingTurnStage([sampleRandomnessCommand]))
    .build();

  const gameExecutorA = createGameExecutor(game);
  const gameExecutorB = createGameExecutor(game);

  const initialA = gameExecutorA.createInitialState();
  const initialB = gameExecutorB.createInitialState();

  const resultA = gameExecutorA.executeCommand(initialA, {
    type: "sample_randomness",
    actorId: "player-1",
    input: {},
  });
  const resultB = gameExecutorB.executeCommand(initialB, {
    type: "sample_randomness",
    actorId: "player-1",
    input: {},
  });

  expect(resultA.ok).toBe(true);
  expect(resultB.ok).toBe(true);
  expect(resultA.state.game).toEqual(resultB.state.game);
  expect(resultA.state.runtime.rng.cursor).toBe(
    resultB.state.runtime.rng.cursor,
  );
});

test("game executor rng cursor advances when randomness is consumed", () => {
  const defineCommand = createCommandFactory<{
    value: number;
  }>();
  const emptyCommandSchema = t.object({});
  const sampleRandomnessCommand = defineCommand({
    commandId: "sample_randomness",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game, rng }) => {
      game.value = rng.number();
    })
    .build();

  const game = new GameDefinitionBuilder<{
    value: number;
  }>("rng-game")
    .initialState(() => ({
      value: 0,
    }))
    .rngSeed("seed-123")
    .initialStage(createSelfLoopingTurnStage([sampleRandomnessCommand]))
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const result = gameExecutor.executeCommand(initialState, {
    type: "sample_randomness",
    actorId: "player-1",
    input: {},
  });

  expect(result.ok).toBe(true);
  expect(initialState.runtime.rng.cursor).toBe(0);
  expect(result.state.runtime.rng.cursor).toBe(1);
});
