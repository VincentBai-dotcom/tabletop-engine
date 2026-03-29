import { expect, test } from "bun:test";
import { createGameExecutor } from "../src/runtime/game-executor";
import { GameDefinitionBuilder } from "../src/game-definition";
import type { CommandDefinition } from "../src/types/command";
import {
  field,
  OwnedByPlayer,
  State,
  t,
  visibleToSelf,
} from "../src/state-facade/metadata";

const emptyPayload = t.object({});

class IncrementScoreCommand implements CommandDefinition<{ score: number }> {
  readonly commandId = "increment_score";
  readonly payloadSchema = emptyPayload;

  validate() {
    return { ok: true as const };
  }

  execute({ game }: { game: { score: number } }) {
    game.score += 1;
  }
}

class DecrementScoreCommand implements CommandDefinition<{ score: number }> {
  readonly commandId = "decrement_score";
  readonly payloadSchema = emptyPayload;

  validate() {
    return { ok: true as const };
  }

  execute({ game }: { game: { score: number } }) {
    game.score -= 1;
  }
}

@State()
class TestHandState {
  @field(t.number())
  size!: number;
}

@State()
class TestRootState {
  @field(t.number())
  score!: number;

  @field(t.state(() => TestHandState))
  hand!: TestHandState;
}

class UndecoratedChildState {
  cards!: number[];
}

@State()
class BrokenRootState {
  @field(t.state(() => UndecoratedChildState))
  child!: UndecoratedChildState;
}

@State()
class TestCardState {
  @field(t.string())
  id!: string;
}

@State()
class TestCollectionRootState {
  @field(t.array(t.state(() => TestCardState)))
  cards!: TestCardState[];
}

@State()
class VisibleToSelfWithoutOwnerRootState {
  @visibleToSelf()
  @field(t.array(t.number()))
  hiddenCards!: number[];
}

@OwnedByPlayer()
@State()
class OwnedPlayerStateWithoutId {
  @field(t.number())
  score!: number;
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

  const gameExecutor = createGameExecutor(game);
  const state = gameExecutor.createInitialState();

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

test("GameDefinitionBuilder compiles reachable root state metadata", () => {
  const game = new GameDefinitionBuilder<{
    score: number;
    hand: {
      size: number;
    };
  }>("root-state-game")
    .rootState(TestRootState)
    .initialState(() => ({
      score: 0,
      hand: {
        size: 0,
      },
    }))
    .commands({})
    .build();

  expect(game.stateFacade?.root).toBe(TestRootState);
  expect(game.stateFacade?.states[TestRootState.name]?.fields.score?.kind).toBe(
    "number",
  );
  expect(game.stateFacade?.states[TestRootState.name]?.fields.hand?.kind).toBe(
    "state",
  );
  expect(game.stateFacade?.states[TestHandState.name]?.fields.size?.kind).toBe(
    "number",
  );
});

test("GameDefinitionBuilder rejects undecorated nested state targets", () => {
  expect(() =>
    new GameDefinitionBuilder<{
      child: {
        cards: number[];
      };
    }>("broken-root-state-game")
      .rootState(BrokenRootState)
      .initialState(() => ({
        child: {
          cards: [],
        },
      }))
      .commands({})
      .build(),
  ).toThrow("state_field_target_must_be_decorated:UndecoratedChildState");
});

test("GameDefinitionBuilder compiles nested state references inside array field types", () => {
  const game = new GameDefinitionBuilder<{
    cards: {
      id: string;
    }[];
  }>("collection-root-state-game")
    .rootState(TestCollectionRootState)
    .initialState(() => ({
      cards: [],
    }))
    .commands({})
    .build();

  expect(game.stateFacade?.root).toBe(TestCollectionRootState);
  expect(
    game.stateFacade?.states[TestCollectionRootState.name]?.fields.cards,
  ).toEqual({
    kind: "array",
    item: {
      kind: "state",
      target: expect.any(Function),
    },
  });
  expect(game.stateFacade?.states[TestCardState.name]?.fields.id?.kind).toBe(
    "string",
  );
});

test("GameDefinitionBuilder rejects visibleToSelf fields without a player-owned ancestor", () => {
  expect(() =>
    new GameDefinitionBuilder<{
      hiddenCards: number[];
    }>("visible-to-self-without-owner-game")
      .rootState(VisibleToSelfWithoutOwnerRootState)
      .initialState(() => ({
        hiddenCards: [],
      }))
      .commands({})
      .build(),
  ).toThrow("visible_to_self_requires_owned_player_ancestor:hiddenCards");
});

test("GameDefinitionBuilder rejects owned player states without a string id field", () => {
  expect(() =>
    new GameDefinitionBuilder<{
      score: number;
    }>("owned-player-without-id-game")
      .rootState(OwnedPlayerStateWithoutId)
      .initialState(() => ({
        score: 0,
      }))
      .commands({})
      .build(),
  ).toThrow("owned_player_requires_string_id_field:OwnedPlayerStateWithoutId");
});
