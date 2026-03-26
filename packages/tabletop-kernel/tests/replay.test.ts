import { expect, test } from "bun:test";
import {
  appendReplayStep,
  createKernel,
  GameDefinitionBuilder,
  createReplayRecord,
  createSnapshot,
  replayRecord,
  restoreSnapshot,
} from "../src/index";

test("snapshots restore canonical state and replay reproduces final state", () => {
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
      increment_counter: {
        validate: () => ({ ok: true as const }),
        execute: ({ game, command }) => {
          const amount =
            typeof command.payload?.amount === "number"
              ? command.payload.amount
              : 1;

          game.counter += amount;
        },
      },
      sample_randomness: {
        validate: () => ({ ok: true as const }),
        execute: ({ game, rng }) => {
          game.value = rng.number();
        },
      },
    })
    .build();

  const kernel = createKernel(game);
  const initialState = kernel.createInitialState();
  const initialSnapshot = createSnapshot(initialState);
  const restoredInitialState = restoreSnapshot(initialSnapshot);
  let replay = createReplayRecord(initialSnapshot);

  const firstCommand = {
    type: "increment_counter",
    payload: { amount: 2 },
  } as const;
  const secondCommand = {
    type: "sample_randomness",
  } as const;

  const firstResult = kernel.executeCommand(restoredInitialState, firstCommand);
  replay = appendReplayStep(replay, firstCommand, firstResult);

  const secondResult = kernel.executeCommand(firstResult.state, secondCommand);
  replay = appendReplayStep(replay, secondCommand, secondResult);

  const replayedState = replayRecord(kernel, replay);

  expect(restoredInitialState).toEqual(initialState);
  expect(replay.commands).toHaveLength(2);
  expect(replay.events).toHaveLength(0);
  expect(replayedState).toEqual(secondResult.state);
});
