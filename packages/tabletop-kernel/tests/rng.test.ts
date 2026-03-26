import { expect, test } from "bun:test";
import { createKernel, GameDefinitionBuilder } from "../src/index";

test("kernel rng is deterministic for the same seed and command sequence", () => {
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
    .commands({
      sample_randomness: {
        validate: () => ({ ok: true as const }),
        execute: ({ game, rng }) => {
          game.value = rng.number();
          game.roll = rng.die(6) as number;
          game.deck = rng.shuffle(game.deck);
        },
      },
    })
    .build();

  const kernelA = createKernel(game);
  const kernelB = createKernel(game);

  const initialA = kernelA.createInitialState();
  const initialB = kernelB.createInitialState();

  const resultA = kernelA.executeCommand(initialA, {
    type: "sample_randomness",
  });
  const resultB = kernelB.executeCommand(initialB, {
    type: "sample_randomness",
  });

  expect(resultA.ok).toBe(true);
  expect(resultB.ok).toBe(true);
  expect(resultA.state.game).toEqual(resultB.state.game);
  expect(resultA.state.runtime.rng.cursor).toBe(
    resultB.state.runtime.rng.cursor,
  );
});

test("kernel rng cursor advances when randomness is consumed", () => {
  const game = new GameDefinitionBuilder<{
    value: number;
  }>("rng-game")
    .initialState(() => ({
      value: 0,
    }))
    .rngSeed("seed-123")
    .commands({
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
  const result = kernel.executeCommand(initialState, {
    type: "sample_randomness",
  });

  expect(result.ok).toBe(true);
  expect(initialState.runtime.rng.cursor).toBe(0);
  expect(result.state.runtime.rng.cursor).toBe(1);
});
