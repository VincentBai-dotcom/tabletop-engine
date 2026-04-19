import type { NobleTile } from "./types.ts";

export const nobleTiles = [
  {
    id: 1,
    name: "Anne of Brittany, Queen of France",
    requirements: { White: 3, Blue: 3, Black: 0, Red: 0, Green: 3 },
  },
  {
    id: 2,
    name: "Catherine de' Medici, Queen of France",
    requirements: { White: 0, Blue: 3, Black: 0, Red: 3, Green: 3 },
  },
  {
    id: 3,
    name: "Charles V, Holy Roman Emperor",
    requirements: { White: 3, Blue: 0, Black: 3, Red: 3, Green: 0 },
  },
  {
    id: 4,
    name: "Elisabeth of Austria, Queen of France",
    requirements: { White: 3, Blue: 3, Black: 3, Red: 0, Green: 0 },
  },
  {
    id: 5,
    name: "Francis I, King of France",
    requirements: { White: 0, Blue: 0, Black: 3, Red: 3, Green: 3 },
  },
  {
    id: 6,
    name: "Henry VIII, King of England",
    requirements: { White: 0, Blue: 0, Black: 4, Red: 4, Green: 0 },
  },
  {
    id: 7,
    name: "Isabella I, Queen of Castile and León",
    requirements: { White: 4, Blue: 0, Black: 4, Red: 0, Green: 0 },
  },
  {
    id: 8,
    name: "Mary, Queen of Scots",
    requirements: { White: 0, Blue: 0, Black: 0, Red: 4, Green: 4 },
  },
  {
    id: 9,
    name: "Niccolò Machiavelli, Diplomat",
    requirements: { White: 4, Blue: 4, Black: 0, Red: 0, Green: 0 },
  },
  {
    id: 10,
    name: "Suleiman the Magnificent, Sultan of the Ottoman Empire",
    requirements: { White: 0, Blue: 4, Black: 0, Red: 0, Green: 4 },
  },
] as const satisfies readonly NobleTile[];

export const nobleTilesById = Object.fromEntries(
  nobleTiles.map((noble) => [noble.id, noble] as const),
) as Readonly<Record<number, NobleTile>>;
