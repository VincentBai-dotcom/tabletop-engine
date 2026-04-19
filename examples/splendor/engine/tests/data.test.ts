import { expect, test } from "bun:test";

import {
  developmentCards,
  developmentCardsByLevel,
  nobleTiles,
} from "../src/index.ts";
import { createCommands } from "../src/commands/index.ts";

test("splendor static data is complete", () => {
  expect(developmentCards).toHaveLength(90);
  expect(nobleTiles).toHaveLength(10);
  expect(developmentCardsByLevel[1]).toHaveLength(40);
  expect(developmentCardsByLevel[2]).toHaveLength(30);
  expect(developmentCardsByLevel[3]).toHaveLength(20);
});

test("splendor static data has stable identifiers", () => {
  const cardIds = new Set(developmentCards.map((card) => card.id));
  const nobleIds = new Set(nobleTiles.map((noble) => noble.id));

  expect(cardIds.size).toBe(90);
  expect(nobleIds.size).toBe(10);
  expect(developmentCards[0]?.id).toBe(1);
  expect(developmentCards.at(-1)?.id).toBe(90);
  expect(nobleTiles[0]?.name).toBe("Anne of Brittany, Queen of France");
  expect(nobleTiles.at(-1)?.name).toBe(
    "Suleiman the Magnificent, Sultan of the Ottoman Empire",
  );
});

test("splendor command registry is composed from factory-defined command objects", () => {
  const commands = createCommands();

  expect(commands.map((command) => command.commandId)).toEqual([
    "take_three_distinct_gems",
    "take_two_same_gems",
    "reserve_face_up_card",
    "reserve_deck_card",
    "buy_face_up_card",
    "buy_reserved_card",
  ]);
});
