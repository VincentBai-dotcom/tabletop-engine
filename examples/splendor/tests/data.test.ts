import { expect, test } from "bun:test";

import {
  developmentCards,
  developmentCardsByLevel,
  nobleTiles,
} from "../src/index.ts";
import {
  BuyFaceUpCardCommand,
  BuyReservedCardCommand,
  ReserveDeckCardCommand,
  ReserveFaceUpCardCommand,
  TakeThreeDistinctGemsCommand,
  TakeTwoSameGemsCommand,
  createCommands,
} from "../src/commands/index.ts";

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

test("splendor command registry is composed from command class instances", () => {
  const commands = createCommands();

  expect(commands[0]).toBeInstanceOf(TakeThreeDistinctGemsCommand);
  expect(commands[1]).toBeInstanceOf(TakeTwoSameGemsCommand);
  expect(commands[2]).toBeInstanceOf(ReserveFaceUpCardCommand);
  expect(commands[3]).toBeInstanceOf(ReserveDeckCardCommand);
  expect(commands[4]).toBeInstanceOf(BuyFaceUpCardCommand);
  expect(commands[5]).toBeInstanceOf(BuyReservedCardCommand);
});
