import { expect, test } from "bun:test";
import { createGameExecutor } from "tabletop-engine";
import { createCommands } from "../src/commands/index.ts";
import { createSplendorGame } from "../src/game";

function createTestGameExecutor(playerIds: string[]) {
  const game = createSplendorGame({
    playerIds,
    seed: "splendor-seed",
  });

  return createGameExecutor(game);
}

test("splendor setup follows official 2-player rules", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  expect(state.game.playerOrder).toEqual(["p1", "p2"]);
  expect(state.game.bank.white).toBe(4);
  expect(state.game.bank.blue).toBe(4);
  expect(state.game.bank.green).toBe(4);
  expect(state.game.bank.red).toBe(4);
  expect(state.game.bank.black).toBe(4);
  expect(state.game.bank.gold).toBe(5);
  expect(state.game.board.faceUpByLevel[1]).toHaveLength(4);
  expect(state.game.board.faceUpByLevel[2]).toHaveLength(4);
  expect(state.game.board.faceUpByLevel[3]).toHaveLength(4);
  expect(state.game.board.nobleIds).toHaveLength(3);
  expect(state.runtime.progression.currentStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "p1",
  });
  expect(state.runtime.progression.lastActingStage).toBeNull();
});

test("splendor game definition compiles a root state facade", () => {
  const game = createSplendorGame({
    playerIds: ["p1", "p2"],
    seed: "splendor-seed",
  });

  expect(game.stateFacade?.root.name).toBe("SplendorGameState");
  const rootFields = game.stateFacade?.states.SplendorGameState?.fields;

  expect(rootFields?.playerOrder?.kind).toBe("array");
  expect(rootFields?.bank?.kind).toBe("state");
  expect(rootFields?.players?.kind).toBe("record");
  if (rootFields?.players?.kind !== "record") {
    throw new Error("expected players to compile as a state record");
  }
  expect(rootFields.players.value.kind).toBe("state");
  expect(game.stateFacade?.states.SplendorPlayerState).toBeDefined();
});

test("splendor setup follows official 4-player rules", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2", "p3", "p4"]);
  const state = gameExecutor.createInitialState();

  expect(state.game.bank.white).toBe(7);
  expect(state.game.bank.blue).toBe(7);
  expect(state.game.bank.green).toBe(7);
  expect(state.game.bank.red).toBe(7);
  expect(state.game.bank.black).toBe(7);
  expect(state.game.bank.gold).toBe(5);
  expect(state.game.board.nobleIds).toHaveLength(5);
});

test("splendor exposes the expected available command families on the opening turn", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  expect(gameExecutor.listAvailableCommands(state, { actorId: "p1" })).toEqual([
    "take_three_distinct_gems",
    "take_two_same_gems",
    "reserve_face_up_card",
    "reserve_deck_card",
  ]);
  expect(gameExecutor.listAvailableCommands(state, { actorId: "p2" })).toEqual(
    [],
  );
});

test("splendor exposes buy commands once the active player can afford them", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  state.game.players.p1!.tokens.gold = 20;
  state.game.players.p1!.reservedCardIds = [24];

  const availableCommands = gameExecutor.listAvailableCommands(state, {
    actorId: "p1",
  });

  expect(availableCommands).toContain("buy_face_up_card");
  expect(availableCommands).toContain("buy_reserved_card");
});

test("splendor commands declare explicit discovery draft schemas", () => {
  const commands = createCommands();

  expect(commands).not.toHaveLength(0);

  for (const command of commands) {
    expect(command.discoverySchema).toBeDefined();
  }
});

test("splendor discovers gem color choices before return tokens for three-distinct take", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  const firstStep = gameExecutor.discoverCommand(state, {
    type: "take_three_distinct_gems",
    actorId: "p1",
    input: {},
  });
  const secondStep = gameExecutor.discoverCommand(state, {
    type: "take_three_distinct_gems",
    actorId: "p1",
    input: {
      selectedColors: ["white", "blue", "green"],
    },
  });

  expect(firstStep).toMatchObject({
    complete: false,
    step: "select_gem_color",
  });
  if (!firstStep || firstStep.complete) {
    throw new Error("expected_incomplete_discovery");
  }
  expect(firstStep.options).toHaveLength(5);
  expect(firstStep.options[0]).toMatchObject({
    id: expect.any(String),
    nextInput: {
      selectedColors: [expect.any(String)],
    },
  });
  expect(secondStep).toMatchObject({
    complete: true,
  });
  if (!secondStep || !secondStep.complete) {
    throw new Error("expected_complete_discovery");
  }
  expect(secondStep.input).toEqual({
    colors: ["white", "blue", "green"],
  });
});

test("splendor buy discovery no longer asks for noble selection", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  state.game.board.nobleIds = [6, 7];
  state.game.players.p1!.tokens.white = 0;
  state.game.players.p1!.tokens.blue = 0;
  state.game.players.p1!.tokens.green = 0;
  state.game.players.p1!.tokens.red = 0;
  state.game.players.p1!.tokens.black = 0;
  state.game.players.p1!.tokens.gold = 20;
  state.game.players.p1!.reservedCardIds = [45];
  state.game.players.p1!.purchasedCardIds = [
    17, 18, 19, 20, 33, 34, 35, 36, 1, 2, 3,
  ];
  state.game.players.p1!.nobleIds = [];

  const discovery = gameExecutor.discoverCommand(state, {
    type: "buy_reserved_card",
    actorId: "p1",
    input: {
      selectedCardId: 45,
    },
  });

  expect(discovery).toMatchObject({
    complete: true,
  });
  if (!discovery || !discovery.complete) {
    throw new Error("expected_complete_discovery");
  }
  expect(discovery.input).toEqual({
    cardId: 45,
  });
});

test("taking three distinct gems updates tokens and advances the turn", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();
  const result = gameExecutor.executeCommand(state, {
    type: "take_three_distinct_gems",
    actorId: "p1",
    input: {
      colors: ["white", "blue", "green"],
    },
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("expected successful gem-taking command");
  }

  expect(result.state.game.players.p1?.tokens).toMatchObject({
    white: 1,
    blue: 1,
    green: 1,
    red: 0,
    black: 0,
    gold: 0,
  });
  expect(result.state.game.bank).toMatchObject({
    white: 3,
    blue: 3,
    green: 3,
  });
  expect(result.state.runtime.progression.currentStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "p2",
  });
  expect(result.state.runtime.progression.lastActingStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "p1",
  });
  expect(result.events[0]).toMatchObject({
    category: "domain",
    type: "gems_taken",
  });
  expect(result.events.map((event) => event.type)).toContain("stage_exited");
  expect(result.events.map((event) => event.type)).toContain("stage_entered");
});

test("taking two gems of the same color requires at least four in the bank", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();
  state.game.bank.red = 3;

  const result = gameExecutor.executeCommand(state, {
    type: "take_two_same_gems",
    actorId: "p1",
    input: {
      color: "red",
    },
  });

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("expected gem-taking validation to fail");
  }

  expect(result.reason).toBe("not_enough_tokens_for_double_take");
  expect(result.state).toBe(state);
  expect(result.state.game.bank.red).toBe(3);
});

test("taking two gems of the same color rejects invalid gem colors explicitly", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  const result = gameExecutor.executeCommand(state, {
    type: "take_two_same_gems",
    actorId: "p1",
    input: {
      color: "purple",
    },
  });

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("expected invalid gem color to fail validation");
  }

  expect(result.reason).toBe("invalid_color");
});

test("reserving a deck card rejects invalid development levels explicitly", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  const result = gameExecutor.executeCommand(state, {
    type: "reserve_deck_card",
    actorId: "p1",
    input: {
      level: 4,
    },
  });

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("expected invalid deck level to fail validation");
  }

  expect(result.reason).toBe("invalid_level");
});

test("reserving a face-up card grants gold and refills the market", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  state.game.board.faceUpByLevel[1] = [1, 2, 3, 4];
  state.game.board.deckByLevel[1] = [5, 6];

  const result = gameExecutor.executeCommand(state, {
    type: "reserve_face_up_card",
    actorId: "p1",
    input: {
      level: 1,
      cardId: 1,
    },
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("expected reserve command to succeed");
  }

  expect(result.state.game.players.p1?.reservedCardIds).toEqual([1]);
  expect(result.state.game.players.p1?.tokens.gold).toBe(1);
  expect(result.state.game.bank.gold).toBe(4);
  expect(result.state.game.board.faceUpByLevel[1]).toEqual([2, 3, 4, 5]);
  expect(result.state.game.board.deckByLevel[1]).toEqual([6]);
  expect(result.state.runtime.progression.currentStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "p2",
  });
  expect(result.state.runtime.progression.lastActingStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "p1",
  });
});

test("buying a reserved card uses discounts and can claim a noble automatically", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  state.game.board.nobleIds = [1];
  state.game.players.p1!.tokens.white = 0;
  state.game.players.p1!.tokens.blue = 0;
  state.game.players.p1!.tokens.green = 4;
  state.game.players.p1!.tokens.red = 0;
  state.game.players.p1!.tokens.black = 0;
  state.game.players.p1!.tokens.gold = 0;
  state.game.players.p1!.reservedCardIds = [24];
  state.game.players.p1!.purchasedCardIds = [17, 18, 9, 10, 11, 25, 26, 27];
  state.game.players.p1!.nobleIds = [];

  const result = gameExecutor.executeCommand(state, {
    type: "buy_reserved_card",
    actorId: "p1",
    input: {
      cardId: 24,
    },
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("expected reserved buy to succeed");
  }

  expect(result.state.game.players.p1?.reservedCardIds).toEqual([]);
  expect(result.state.game.players.p1?.purchasedCardIds).toContain(24);
  expect(result.state.game.players.p1?.tokens.green).toBe(3);
  expect(result.state.game.players.p1?.nobleIds).toEqual([1]);
  expect(result.state.game.board.nobleIds).toEqual([]);
  expect(result.events.map((event) => event.type)).toContain("noble_claimed");
});

test("buying with multiple eligible nobles moves into the choose-noble stage", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  state.game.board.nobleIds = [6, 7];
  state.game.players.p1!.tokens.white = 0;
  state.game.players.p1!.tokens.blue = 0;
  state.game.players.p1!.tokens.green = 0;
  state.game.players.p1!.tokens.red = 0;
  state.game.players.p1!.tokens.black = 0;
  state.game.players.p1!.tokens.gold = 20;
  state.game.players.p1!.reservedCardIds = [45];
  state.game.players.p1!.purchasedCardIds = [
    17, 18, 19, 20, 33, 34, 35, 36, 1, 2, 3,
  ];
  state.game.players.p1!.nobleIds = [];

  const result = gameExecutor.executeCommand(state, {
    type: "buy_reserved_card",
    actorId: "p1",
    input: {
      cardId: 45,
    },
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("expected reserved buy to succeed");
  }

  expect(result.state.runtime.progression.currentStage).toEqual({
    id: "chooseNoble",
    kind: "activePlayer",
    activePlayerId: "p1",
  });
  expect(result.state.game.players.p1?.nobleIds).toEqual([]);
  expect(result.events.map((event) => event.type)).not.toContain(
    "noble_claimed",
  );
  expect(
    gameExecutor.listAvailableCommands(result.state, {
      actorId: "p1",
    }),
  ).toEqual(["choose_noble"]);
});

test("choosing a noble claims it and then advances to the next player", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  state.game.board.nobleIds = [6, 7];
  state.game.players.p1!.tokens.white = 0;
  state.game.players.p1!.tokens.blue = 0;
  state.game.players.p1!.tokens.green = 0;
  state.game.players.p1!.tokens.red = 0;
  state.game.players.p1!.tokens.black = 0;
  state.game.players.p1!.tokens.gold = 20;
  state.game.players.p1!.reservedCardIds = [45];
  state.game.players.p1!.purchasedCardIds = [
    17, 18, 19, 20, 33, 34, 35, 36, 1, 2, 3,
  ];
  state.game.players.p1!.nobleIds = [];

  const buyResult = gameExecutor.executeCommand(state, {
    type: "buy_reserved_card",
    actorId: "p1",
    input: {
      cardId: 45,
    },
  });

  if (!buyResult.ok) {
    throw new Error("expected reserved buy to succeed");
  }

  const chooseResult = gameExecutor.executeCommand(buyResult.state, {
    type: "choose_noble",
    actorId: "p1",
    input: {
      nobleId: 6,
    },
  });

  expect(chooseResult.ok).toBe(true);

  if (!chooseResult.ok) {
    throw new Error("expected choose_noble to succeed");
  }

  expect(chooseResult.state.game.players.p1?.nobleIds).toEqual([6]);
  expect(chooseResult.state.game.board.nobleIds).toEqual([7]);
  expect(chooseResult.state.runtime.progression.currentStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "p2",
  });
  expect(chooseResult.events.map((event) => event.type)).toContain(
    "noble_claimed",
  );
});

test("endgame finishes after the final player in turn order and breaks ties by fewest cards", () => {
  const gameExecutor = createTestGameExecutor(["p1", "p2"]);
  const state = gameExecutor.createInitialState();

  state.game.players.p1!.tokens.white = 0;
  state.game.players.p1!.tokens.blue = 0;
  state.game.players.p1!.tokens.green = 0;
  state.game.players.p1!.tokens.red = 0;
  state.game.players.p1!.tokens.black = 0;
  state.game.players.p1!.tokens.gold = 7;
  state.game.players.p1!.reservedCardIds = [43];
  state.game.players.p1!.purchasedCardIds = [74, 72, 46, 8];
  state.game.players.p1!.nobleIds = [];
  state.game.players.p2!.tokens.white = 0;
  state.game.players.p2!.tokens.blue = 6;
  state.game.players.p2!.tokens.green = 0;
  state.game.players.p2!.tokens.red = 0;
  state.game.players.p2!.tokens.black = 0;
  state.game.players.p2!.tokens.gold = 0;
  state.game.players.p2!.reservedCardIds = [52];
  state.game.players.p2!.purchasedCardIds = [78, 80, 46];
  state.game.players.p2!.nobleIds = [];

  const firstResult = gameExecutor.executeCommand(state, {
    type: "buy_reserved_card",
    actorId: "p1",
    input: {
      cardId: 43,
    },
  });

  expect(firstResult.ok).toBe(true);

  if (!firstResult.ok) {
    throw new Error("expected first reserved buy to succeed");
  }

  expect(firstResult.state.game.endGame).toEqual({
    triggeredByPlayerId: "p1",
    endsAfterPlayerId: "p2",
  });
  expect(firstResult.state.game.winnerIds).toBeNull();
  expect(firstResult.state.runtime.progression.currentStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "p2",
  });
  expect(firstResult.state.runtime.progression.lastActingStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "p1",
  });

  const secondResult = gameExecutor.executeCommand(firstResult.state, {
    type: "buy_reserved_card",
    actorId: "p2",
    input: {
      cardId: 52,
    },
  });

  expect(secondResult.ok).toBe(true);

  if (!secondResult.ok) {
    throw new Error("expected final reserved buy to succeed");
  }

  expect(secondResult.state.game.players.p1?.purchasedCardIds).toHaveLength(5);
  expect(secondResult.state.game.players.p2?.purchasedCardIds).toHaveLength(4);
  expect(secondResult.state.game.winnerIds).toEqual(["p2"]);
  expect(secondResult.events.map((event) => event.type)).toContain(
    "game_finished",
  );
});
