import { expect, test } from "bun:test";
import { createKernel } from "tabletop-kernel";
import { createSplendorGame } from "../src/game";

function createTestKernel(playerIds: string[]) {
  const game = createSplendorGame({
    playerIds,
    seed: "splendor-seed",
  });

  return createKernel(game);
}

test("splendor setup follows official 2-player rules", () => {
  const kernel = createTestKernel(["p1", "p2"]);
  const state = kernel.createInitialState();

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
  expect(state.runtime.progression.segments.turn?.ownerId).toBe("p1");
});

test("splendor setup follows official 4-player rules", () => {
  const kernel = createTestKernel(["p1", "p2", "p3", "p4"]);
  const state = kernel.createInitialState();

  expect(state.game.bank.white).toBe(7);
  expect(state.game.bank.blue).toBe(7);
  expect(state.game.bank.green).toBe(7);
  expect(state.game.bank.red).toBe(7);
  expect(state.game.bank.black).toBe(7);
  expect(state.game.bank.gold).toBe(5);
  expect(state.game.board.nobleIds).toHaveLength(5);
});

test("splendor exposes the expected available command families on the opening turn", () => {
  const kernel = createTestKernel(["p1", "p2"]);
  const state = kernel.createInitialState();

  expect(kernel.listAvailableCommands(state, { actorId: "p1" })).toEqual([
    "take_three_distinct_gems",
    "take_two_same_gems",
    "reserve_face_up_card",
    "reserve_deck_card",
  ]);
  expect(kernel.listAvailableCommands(state, { actorId: "p2" })).toEqual([]);
});

test("splendor exposes buy commands once the active player can afford them", () => {
  const kernel = createTestKernel(["p1", "p2"]);
  const state = kernel.createInitialState();

  state.game.players.p1!.tokens.gold = 20;
  state.game.players.p1!.reservedCardIds = [24];

  const availableCommands = kernel.listAvailableCommands(state, {
    actorId: "p1",
  });

  expect(availableCommands).toContain("buy_face_up_card");
  expect(availableCommands).toContain("buy_reserved_card");
});

test("taking three distinct gems updates tokens and advances the turn", () => {
  const kernel = createTestKernel(["p1", "p2"]);
  const state = kernel.createInitialState();
  const result = kernel.executeCommand(state, {
    type: "take_three_distinct_gems",
    actorId: "p1",
    payload: {
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
  expect(result.state.runtime.progression.segments.turn?.ownerId).toBe("p2");
  expect(result.events[0]).toMatchObject({
    category: "domain",
    type: "gems_taken",
  });
  expect(result.events.map((event) => event.type)).toContain("segment_exited");
  expect(result.events.map((event) => event.type)).toContain("segment_entered");
});

test("taking two gems of the same color requires at least four in the bank", () => {
  const kernel = createTestKernel(["p1", "p2"]);
  const state = kernel.createInitialState();
  state.game.bank.red = 3;

  const result = kernel.executeCommand(state, {
    type: "take_two_same_gems",
    actorId: "p1",
    payload: {
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

test("reserving a face-up card grants gold and refills the market", () => {
  const kernel = createTestKernel(["p1", "p2"]);
  const state = kernel.createInitialState();

  state.game.board.faceUpByLevel[1] = [1, 2, 3, 4];
  state.game.board.deckByLevel[1] = [5, 6];

  const result = kernel.executeCommand(state, {
    type: "reserve_face_up_card",
    actorId: "p1",
    payload: {
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
  expect(result.state.runtime.progression.segments.turn?.ownerId).toBe("p2");
});

test("buying a reserved card uses discounts and can claim a noble automatically", () => {
  const kernel = createTestKernel(["p1", "p2"]);
  const state = kernel.createInitialState();

  state.game.board.nobleIds = [1];
  state.game.players.p1 = {
    ...state.game.players.p1!,
    tokens: {
      white: 0,
      blue: 0,
      green: 4,
      red: 0,
      black: 0,
      gold: 0,
    },
    reservedCardIds: [24],
    purchasedCardIds: [17, 18, 9, 10, 11, 25, 26, 27],
    nobleIds: [],
  };

  const result = kernel.executeCommand(state, {
    type: "buy_reserved_card",
    actorId: "p1",
    payload: {
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

test("endgame finishes after the final player in turn order and breaks ties by fewest cards", () => {
  const kernel = createTestKernel(["p1", "p2"]);
  const state = kernel.createInitialState();

  state.game.players.p1 = {
    ...state.game.players.p1!,
    tokens: {
      white: 0,
      blue: 0,
      green: 0,
      red: 0,
      black: 0,
      gold: 7,
    },
    reservedCardIds: [43],
    purchasedCardIds: [74, 72, 46, 8],
    nobleIds: [],
  };
  state.game.players.p2 = {
    ...state.game.players.p2!,
    tokens: {
      white: 0,
      blue: 6,
      green: 0,
      red: 0,
      black: 0,
      gold: 0,
    },
    reservedCardIds: [52],
    purchasedCardIds: [78, 80, 46],
    nobleIds: [],
  };

  const firstResult = kernel.executeCommand(state, {
    type: "buy_reserved_card",
    actorId: "p1",
    payload: {
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
  expect(firstResult.state.runtime.progression.segments.turn?.ownerId).toBe(
    "p2",
  );

  const secondResult = kernel.executeCommand(firstResult.state, {
    type: "buy_reserved_card",
    actorId: "p2",
    payload: {
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
