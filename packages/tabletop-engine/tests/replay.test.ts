import { expect, test } from "bun:test";
import {
  appendReplayStep,
  createCommandFactory,
  createGameExecutor,
  GameDefinitionBuilder,
  createReplayRecord,
  createSnapshot,
  replayRecord,
  restoreSnapshot,
  t,
} from "../src/index";

test("snapshots restore canonical state and replay reproduces final state", () => {
  const defineCommand = createCommandFactory<{
    counter: number;
    value: number;
  }>();
  const incrementCommandSchema = t.object({
    amount: t.optional(t.number()),
  });
  const emptyCommandSchema = t.object({});

  const game = new GameDefinitionBuilder<{
    counter: number;
    value: number;
  }>("replay-game")
    .initialState(() => ({
      counter: 0,
      value: 0,
    }))
    .rngSeed("seed-123")
    .commands({
      increment_counter: defineCommand({
        commandId: "increment_counter",
        commandSchema: incrementCommandSchema,
      })
        .validate(() => ({ ok: true as const }))
        .execute(({ game, command }) => {
          const amount =
            typeof command.input?.amount === "number"
              ? command.input.amount
              : 1;

          game.counter += amount;
        })
        .build(),
      sample_randomness: defineCommand({
        commandId: "sample_randomness",
        commandSchema: emptyCommandSchema,
      })
        .validate(() => ({ ok: true as const }))
        .execute(({ game, rng }) => {
          game.value = rng.number();
        })
        .build(),
    })
    .build();

  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState();
  const initialSnapshot = createSnapshot(initialState);
  const restoredInitialState = restoreSnapshot(initialSnapshot);
  let replay = createReplayRecord(initialSnapshot);

  const firstCommand = {
    type: "increment_counter",
    input: { amount: 2 },
  } as const;
  const secondCommand = {
    type: "sample_randomness",
  } as const;

  const firstResult = gameExecutor.executeCommand(
    restoredInitialState,
    firstCommand,
  );
  replay = appendReplayStep(replay, firstCommand, firstResult);

  const secondResult = gameExecutor.executeCommand(
    firstResult.state,
    secondCommand,
  );
  replay = appendReplayStep(replay, secondCommand, secondResult);

  const replayedState = replayRecord(gameExecutor, replay);

  expect(restoredInitialState).toEqual(initialState);
  expect(replay.commands).toHaveLength(2);
  expect(replay.events).toHaveLength(0);
  expect(replayedState).toEqual(secondResult.state);
});
