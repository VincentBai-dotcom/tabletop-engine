import { expect, test } from "bun:test";
import { createGameExecutor } from "../src/kernel/create-kernel";
import { GameDefinitionBuilder } from "../src/game-definition";

test("GameDefinitionBuilder preserves the supplied configuration", () => {
  const game = new GameDefinitionBuilder<{
    score: number;
  }>("test-game")
    .initialState(() => ({
      score: 0,
    }))
    .commands({})
    .progression({
      root: {
        id: "round",
        children: [
          {
            id: "main",
            kind: "phase",
            children: [],
          },
        ],
      },
    })
    .build();

  expect(game.name).toBe("test-game");
  expect(game.initialState().score).toBe(0);
  expect(game.commands).toEqual({});
  expect(game.progression?.root.children[0]?.id).toBe("main");
});

test("createGameExecutor normalizes nested progression trees into runtime state", () => {
  const game = new GameDefinitionBuilder<{
    score: number;
  }>("progression-game")
    .initialState(() => ({
      score: 0,
    }))
    .commands({})
    .progression({
      root: {
        id: "round",
        kind: "round",
        children: [
          {
            id: "turn",
            kind: "turn",
            children: [
              {
                id: "main",
                kind: "phase",
                children: [],
              },
            ],
          },
        ],
      },
    })
    .build();

  const kernel = createGameExecutor(game);
  const state = kernel.createInitialState();

  expect(state.runtime.progression.rootId).toBe("round");
  expect(state.runtime.progression.current).toBe("main");
  expect(state.runtime.progression.segments.round).toMatchObject({
    id: "round",
    kind: "round",
    parentId: undefined,
    childIds: ["turn"],
    active: true,
  });
  expect(state.runtime.progression.segments.turn).toMatchObject({
    id: "turn",
    kind: "turn",
    parentId: "round",
    childIds: ["main"],
    active: true,
  });
  expect(state.runtime.progression.segments.main).toMatchObject({
    id: "main",
    kind: "phase",
    parentId: "turn",
    childIds: [],
    active: true,
  });
});

test("GameDefinitionBuilder builds the same game definition shape", () => {
  const game = new GameDefinitionBuilder<{
    score: number;
  }>("builder-game")
    .initialState(() => ({
      score: 0,
    }))
    .commands({})
    .progression({
      root: {
        id: "round",
        children: [],
      },
    })
    .build();

  expect(game.name).toBe("builder-game");
  expect(game.initialState().score).toBe(0);
  expect(game.commands).toEqual({});
  expect(game.progression?.root.id).toBe("round");
});
