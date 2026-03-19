import { expect, test } from "bun:test";
import { defineGame } from "../src/game-definition";

test("defineGame preserves the supplied configuration", () => {
  const game = defineGame({
    name: "test-game",
    initialState: () => ({
      score: 0,
    }),
    commands: {},
    progression: {
      initial: "main",
      segments: {
        main: {
          id: "main",
          kind: "phase",
          name: "Main",
        },
      },
    },
  });

  expect(game.name).toBe("test-game");
  expect(game.initialState().score).toBe(0);
  expect(game.commands).toEqual({});
  expect(game.progression?.initial).toBe("main");
});
