import { expect, test } from "bun:test";
import { createGameExecutor } from "../src/runtime/game-executor";
import { GameDefinitionBuilder } from "../src/game-definition";
import { createCommandFactory } from "../src/command-factory";
import { createStageFactory } from "../src/stage-factory";
import { assertSchemaValue } from "../src/runtime/validation";
import type { SingleActivePlayerStageDefinition } from "../src/types/progression";
import {
  configureVisibility,
  field,
  State,
  t,
} from "../src/state-facade/metadata";

const emptyCommandSchema = t.object({});
const defineTestStage = createStageFactory<object>();

@State()
class TestHandState {
  @field(t.number())
  size = 0;
}

@State()
class TestRootState {
  @field(t.number())
  score = 0;

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
  id = "";
}

@State()
class TestCollectionRootState {
  @field(t.array(t.state(() => TestCardState)))
  cards: TestCardState[] = [];
}

@State()
class VisibleToSelfWithoutOwnerRootState {
  @field(t.array(t.number()))
  hiddenCards: number[] = [];
}

@State()
class OwnedPlayerStateWithoutId {
  @field(t.number())
  score = 0;
}

@State()
class VisibilityFieldTypoRootState {
  @field(t.array(t.number()))
  hiddenCards: number[] = [];
}

configureVisibility(VisibleToSelfWithoutOwnerRootState, ({ field }) => ({
  fields: [field.hiddenCards.visibleToSelf()],
}));

configureVisibility(OwnedPlayerStateWithoutId, ({ field }) => ({
  ownedBy: field.score as never,
}));

configureVisibility(VisibilityFieldTypoRootState, ({ field }) => ({
  fields: [
    ((field as unknown as { cardz: { hidden(): unknown } }).cardz.hidden() ??
      undefined) as never,
  ],
}));

@State()
class ScoreRootState {
  @field(t.number())
  score = 0;
}

@State()
class MismatchedDefaultRootState {
  @field(t.number())
  name = "";
}

@State()
class UndeclaredDefaultRootState {
  @field(t.number())
  score = 0;

  cache = "not canonical";
}

test("GameDefinitionBuilder preserves the supplied configuration", () => {
  const gameEndStage = defineTestStage("gameEnd").automatic().build();

  const game = new GameDefinitionBuilder("test-game")
    .rootState(ScoreRootState)
    .initialStage(gameEndStage)
    .build();

  expect(game.name).toBe("test-game");
  expect(game.defaultCanonicalGameState).toEqual({
    score: 0,
  });
  expect(game.commands).toEqual({});
});

test("GameDefinitionBuilder rejects field defaults that do not match their schema", () => {
  expect(() =>
    new GameDefinitionBuilder("mismatched-default-game")
      .rootState(MismatchedDefaultRootState)
      .initialStage(defineTestStage("gameEnd").automatic().build())
      .build(),
  ).toThrow("invalid_schema_value");
});

test("GameDefinitionBuilder rejects initialized public state properties without field metadata", () => {
  expect(() =>
    new GameDefinitionBuilder("undeclared-default-game")
      .rootState(UndeclaredDefaultRootState)
      .initialStage(defineTestStage("gameEnd").automatic().build())
      .build(),
  ).toThrow("undeclared_state_field_value:UndeclaredDefaultRootState.cache");
});

test("GameDefinitionBuilder compiles stage command references into the command map shape", () => {
  const defineCommand = createCommandFactory<{ score: number }>();
  const incrementScoreCommand = defineCommand({
    commandId: "increment_score",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => {
      return { ok: true as const };
    })
    .execute(({ game }) => {
      game.score += 1;
    })
    .build();
  const decrementScoreCommand = defineCommand({
    commandId: "decrement_score",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => {
      return { ok: true as const };
    })
    .execute(({ game }) => {
      game.score -= 1;
    })
    .build();
  const scoreTurnStage = createScoreTurnStage();

  function createScoreTurnStage(): SingleActivePlayerStageDefinition<object> {
    return defineTestStage("scoreTurn")
      .singleActivePlayer()
      .activePlayer(() => "player-1")
      .commands([incrementScoreCommand, decrementScoreCommand])
      .nextStages(() => ({ scoreTurnStage }))
      .transition(({ nextStages }) => nextStages.scoreTurnStage)
      .build();
  }

  const game = new GameDefinitionBuilder("list-builder-game")
    .rootState(ScoreRootState)
    .initialStage(scoreTurnStage)
    .build();

  expect(Object.keys(game.commands)).toEqual([
    "increment_score",
    "decrement_score",
  ]);
  expect(game.commands.increment_score).toBe(incrementScoreCommand);
  expect(game.commands.decrement_score).toBe(decrementScoreCommand);
});

test("GameDefinitionBuilder compiles multi-active stage command references into the command map shape", () => {
  const defineCommand = createCommandFactory<{ score: number }>();
  const submitVoteCommand = defineCommand({
    commandId: "submit_vote",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => {
      return { ok: true as const };
    })
    .execute(({ game }) => {
      game.score += 1;
    })
    .build();
  const gameEndStage = defineTestStage("gameEnd").automatic().build();
  const voteStage = defineTestStage("voteStage")
    .multiActivePlayer()
    .memory(
      t.object({
        submittedByPlayerId: t.record(t.string(), t.boolean()),
      }),
      () => ({
        submittedByPlayerId: {} as Record<string, true>,
      }),
    )
    .activePlayers(({ memory }) => {
      return ["player-1", "player-2"].filter((playerId) => {
        return memory.submittedByPlayerId[playerId] !== true;
      });
    })
    .commands([submitVoteCommand])
    .onSubmit(({ command, execute, memory }) => {
      memory.submittedByPlayerId[command.actorId] = true;
      execute(command);
    })
    .isComplete(({ memory }) => {
      return Object.keys(memory.submittedByPlayerId).length === 2;
    })
    .nextStages(() => ({
      gameEndStage,
    }))
    .transition(({ nextStages }) => nextStages.gameEndStage)
    .build();

  const game = new GameDefinitionBuilder("multi-active-list-builder-game")
    .rootState(ScoreRootState)
    .initialStage(voteStage)
    .build();

  expect(Object.keys(game.commands)).toEqual(["submit_vote"]);
  expect(game.commands.submit_vote).toBe(submitVoteCommand);
});

test("GameDefinitionBuilder assembles runtimeStateSchema with multi-active memory shape", () => {
  const defineCommand = createCommandFactory<{ score: number }>();
  const defineStage = createStageFactory<{ score: number }>();
  const submitVoteCommand = defineCommand({
    commandId: "submit_vote",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => {
      return { ok: true as const };
    })
    .execute(() => {})
    .build();
  const gameEndStage = defineStage("gameEnd").automatic().build();
  const voteStage = defineStage("voteStage")
    .multiActivePlayer()
    .memory(
      t.object({
        submittedByPlayerId: t.record(t.string(), t.boolean()),
      }),
      () => ({
        submittedByPlayerId: {} as Record<string, true>,
      }),
    )
    .activePlayers(() => ["player-1", "player-2"])
    .commands([submitVoteCommand])
    .onSubmit(() => {})
    .isComplete(() => false)
    .nextStages(() => ({
      gameEndStage,
    }))
    .transition(({ nextStages }) => nextStages.gameEndStage)
    .build();

  const game = new GameDefinitionBuilder("runtime-state-schema-game")
    .rootState(ScoreRootState)
    .initialStage(voteStage)
    .build();

  expect(game.runtimeStateSchema).toBeDefined();

  expect(() =>
    assertSchemaValue(game.runtimeStateSchema, {
      progression: {
        currentStage: {
          id: "voteStage",
          kind: "multiActivePlayer",
          activePlayerIds: ["player-1", "player-2"],
          memory: {
            submittedByPlayerId: {
              "player-1": true,
            },
          },
        },
        lastActingStage: null,
      },
      rng: {
        seed: "seed",
        cursor: 0,
      },
      history: {
        entries: [],
      },
    }),
  ).not.toThrow();

  expect(() =>
    assertSchemaValue(game.runtimeStateSchema, {
      progression: {
        currentStage: {
          id: "voteStage",
          kind: "multiActivePlayer",
          activePlayerIds: ["player-1", "player-2"],
          memory: {
            submittedByPlayerId: {
              "player-1": "yes",
            },
          },
        },
        lastActingStage: null,
      },
      rng: {
        seed: "seed",
        cursor: 0,
      },
      history: {
        entries: [],
      },
    }),
  ).toThrow("invalid_schema_value");
});

test("GameDefinitionBuilder accepts factory-defined commands through stages only", () => {
  const defineCommand = createCommandFactory<{ score: number }>();

  const incrementScoreCommand = defineCommand({
    commandId: "increment_score",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => {
      return { ok: true as const };
    })
    .execute(({ game }) => {
      game.score += 1;
    })
    .build();

  const decrementScoreCommand = defineCommand({
    commandId: "decrement_score",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => {
      return { ok: true as const };
    })
    .execute(({ game }) => {
      game.score -= 1;
    })
    .build();
  const gameEndStage = defineTestStage("gameEnd").automatic().build();
  const scoreTurnStage = createScoreTurnStage();

  function createScoreTurnStage(): SingleActivePlayerStageDefinition<object> {
    return defineTestStage("scoreTurn")
      .singleActivePlayer()
      .activePlayer(() => "player-1")
      .commands([incrementScoreCommand, decrementScoreCommand])
      .nextStages(() => ({
        scoreTurnStage,
        gameEndStage,
      }))
      .transition(({ nextStages }) => {
        return nextStages.gameEndStage ?? nextStages.scoreTurnStage;
      })
      .build();
  }

  const game = new GameDefinitionBuilder("factory-list-builder-game")
    .rootState(ScoreRootState)
    .initialStage(scoreTurnStage)
    .build();

  expect(Object.keys(game.commands)).toEqual([
    "increment_score",
    "decrement_score",
  ]);
  expect(Object.keys(game.stages)).toEqual(["scoreTurn", "gameEnd"]);
});

test("GameDefinitionBuilder rejects duplicate command ids across reachable stages", () => {
  const defineCommand = createCommandFactory<{ score: number }>();
  const incrementScoreCommand = defineCommand({
    commandId: "increment_score",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => {
      return { ok: true as const };
    })
    .execute(({ game }) => {
      game.score += 1;
    })
    .build();
  const duplicateIncrementScoreCommand = defineCommand({
    commandId: "increment_score",
    commandSchema: emptyCommandSchema,
  })
    .validate(() => {
      return { ok: true as const };
    })
    .execute(({ game }) => {
      game.score += 2;
    })
    .build();
  const gameEndStage = defineTestStage("gameEnd").automatic().build();
  const scoreTurnStage = defineTestStage("scoreTurn")
    .singleActivePlayer()
    .activePlayer(() => "player-1")
    .commands([incrementScoreCommand])
    .nextStages(() => ({
      gameEndStage,
    }))
    .transition(({ nextStages }) => nextStages.gameEndStage)
    .build();
  const bonusTurnStage = createBonusTurnStage();

  function createBonusTurnStage(): SingleActivePlayerStageDefinition<object> {
    return defineTestStage("bonusTurn")
      .singleActivePlayer()
      .activePlayer(() => "player-2")
      .commands([duplicateIncrementScoreCommand])
      .nextStages(() => ({ bonusTurnStage }))
      .transition(({ nextStages }) => nextStages.bonusTurnStage)
      .build();
  }
  const rootStage = defineTestStage("root")
    .automatic()
    .nextStages(() => ({
      scoreTurnStage,
      bonusTurnStage,
    }))
    .transition(({ nextStages }) => nextStages.scoreTurnStage)
    .build();
  void bonusTurnStage;

  expect(() =>
    new GameDefinitionBuilder("duplicate-command-game")
      .rootState(ScoreRootState)
      .initialStage(rootStage)
      .build(),
  ).toThrow("duplicate_command_id:increment_score");
});

test("GameDefinitionBuilder only accepts commands created by the command factory through stages", () => {
  const legacyCommand = {
    commandId: "legacy",
    commandSchema: emptyCommandSchema,
    validate: () => ({ ok: true as const }),
    execute: ({ game }: { game: { score: number } }) => {
      game.score += 1;
    },
  };

  const builder = new GameDefinitionBuilder("legacy-command-game").rootState(
    ScoreRootState,
  );

  const turnStage = createTurnStage();

  function createTurnStage(): SingleActivePlayerStageDefinition<object> {
    return defineTestStage("turn")
      .singleActivePlayer()
      .activePlayer(() => "player-1")
      .commands([
        // @ts-expect-error commands must be created by createCommandFactory
        legacyCommand,
      ])
      .nextStages(() => ({ turnStage }))
      .transition(({ nextStages }) => nextStages.turnStage)
      .build();
  }

  builder.initialStage(turnStage);
});

test("createGameExecutor creates initial stage-machine runtime state", () => {
  const gameEndStage = defineTestStage("gameEnd").automatic().build();
  const playerTurnStage = createPlayerTurnStage();

  function createPlayerTurnStage(): SingleActivePlayerStageDefinition<object> {
    return defineTestStage("playerTurn")
      .singleActivePlayer()
      .activePlayer(() => "player-1")
      .nextStages(() => ({
        playerTurnStage,
        gameEndStage,
      }))
      .commands([])
      .transition(({ nextStages }) => {
        return nextStages.playerTurnStage;
      })
      .build();
  }
  const game = new GameDefinitionBuilder("progression-game")
    .rootState(ScoreRootState)
    .initialStage(playerTurnStage)
    .build();

  const gameExecutor = createGameExecutor(game);
  const state = gameExecutor.createInitialState();

  expect(state.runtime.progression.currentStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "player-1",
  });
});

test("GameDefinitionBuilder builds the same game definition shape", () => {
  const gameEndStage = defineTestStage("gameEnd").automatic().build();
  const game = new GameDefinitionBuilder("builder-game")
    .rootState(ScoreRootState)
    .initialStage(gameEndStage)
    .build();

  expect(game.name).toBe("builder-game");
  expect(game.defaultCanonicalGameState).toEqual({
    score: 0,
  });
  expect(game.commands).toEqual({});
});

test("GameDefinitionBuilder compiles reachable root state metadata", () => {
  const game = new GameDefinitionBuilder("root-state-game")
    .rootState(TestRootState)
    .initialStage(defineTestStage("gameEnd").automatic().build())
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
    new GameDefinitionBuilder("broken-root-state-game")
      .rootState(BrokenRootState)
      .initialStage(defineTestStage("gameEnd").automatic().build())
      .build(),
  ).toThrow("state_field_target_must_be_decorated:UndecoratedChildState");
});

test("GameDefinitionBuilder compiles nested state references inside array field types", () => {
  const game = new GameDefinitionBuilder("collection-root-state-game")
    .rootState(TestCollectionRootState)
    .initialStage(defineTestStage("gameEnd").automatic().build())
    .build();

  expect(game.stateFacade?.root).toBe(TestCollectionRootState);
  expect(
    game.stateFacade?.states[TestCollectionRootState.name]?.fields.cards,
  ).toMatchObject({
    kind: "array",
    item: {
      kind: "state",
    },
  });
  expect(
    game.stateFacade?.states[TestCollectionRootState.name]?.fields.cards?.kind,
  ).toBe("array");
  expect(game.stateFacade?.states[TestCardState.name]?.fields.id?.kind).toBe(
    "string",
  );
});

test("GameDefinitionBuilder rejects visibleToSelf fields without a player-owned ancestor", () => {
  expect(() =>
    new GameDefinitionBuilder("visible-to-self-without-owner-game")
      .rootState(VisibleToSelfWithoutOwnerRootState)
      .initialStage(defineTestStage("gameEnd").automatic().build())
      .build(),
  ).toThrow("visible_to_self_requires_owned_player_ancestor:hiddenCards");
});

test("GameDefinitionBuilder rejects owned player states without a string id field", () => {
  expect(() =>
    new GameDefinitionBuilder("owned-player-without-id-game")
      .rootState(OwnedPlayerStateWithoutId)
      .initialStage(defineTestStage("gameEnd").automatic().build())
      .build(),
  ).toThrow(
    "owned_by_field_requires_string_field:OwnedPlayerStateWithoutId:score",
  );
});

test("GameDefinitionBuilder rejects unknown configured visibility fields", () => {
  expect(() =>
    new GameDefinitionBuilder("visibility-field-typo-game")
      .rootState(VisibilityFieldTypoRootState)
      .initialStage(defineTestStage("gameEnd").automatic().build())
      .build(),
  ).toThrow("visibility_field_not_found:VisibilityFieldTypoRootState:cardz");
});
