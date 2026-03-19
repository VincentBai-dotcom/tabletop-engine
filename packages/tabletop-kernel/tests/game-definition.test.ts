import { expect, test } from "bun:test";
import { defineGame } from "../src/game-definition";

test("defineGame preserves the supplied configuration", () => {
  const game = defineGame({
    name: "test-game",
    initialState: () => ({
      score: 0,
    }),
    commands: {},
  });

  expect(game.name).toBe("test-game");
  expect(game.initialState().score).toBe(0);
  expect(game.commands).toEqual({});
});
