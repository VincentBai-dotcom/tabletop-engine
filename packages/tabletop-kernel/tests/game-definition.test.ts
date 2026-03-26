import { expect, test } from "bun:test";
import { createGameExecutor } from "../src/kernel/create-kernel";
import { GameDefinitionBuilder } from "../src/game-definition";
import type { CommandDefinition } from "../src/types/command";

class IncrementScoreCommand implements CommandDefinition<{ score: number }> {
  readonly commandId = "increment_score";

  validate() {
    return { ok: true as const };
  }

  execute({ game }: { game: { score: number } }) {
    game.score += 1;
  }
}

class DecrementScoreCommand implements CommandDefinition<{ score: number }> {
  readonly commandId = "decrement_score";

  validate() {
    return { ok: true as const };
  }

  execute({ game }: { game: { score: number } }) {
    game.score -= 1;
  }
}

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

test("GameDefinitionBuilder compiles command lists into the command map shape", () => {
  const game = new GameDefinitionBuilder<{
    score: number;
  }>("list-builder-game")
    .initialState(() => ({
      score: 0,
    }))
    .commands([new IncrementScoreCommand(), new DecrementScoreCommand()])
    .build();

  expect(Object.keys(game.commands)).toEqual([
    "increment_score",
    "decrement_score",
  ]);
  expect(game.commands.increment_score).toBeInstanceOf(IncrementScoreCommand);
  expect(game.commands.decrement_score).toBeInstanceOf(DecrementScoreCommand);
});

test("GameDefinitionBuilder rejects duplicate command ids in command lists", () => {
  expect(() =>
    new GameDefinitionBuilder<{
      score: number;
    }>("duplicate-command-game")
      .initialState(() => ({
        score: 0,
      }))
      .commands([new IncrementScoreCommand(), new IncrementScoreCommand()])
      .build(),
  ).toThrow("duplicate_command_id:increment_score");
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
