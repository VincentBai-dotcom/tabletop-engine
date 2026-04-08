import { field, hidden, State, t } from "tabletop-engine";
import type { DevelopmentLevel } from "../data/types.ts";

const hiddenDeckSummarySchema = t.object({
  1: t.number(),
  2: t.number(),
  3: t.number(),
});

@State()
export class SplendorBoardState {
  @field(t.record(t.number(), t.array(t.number())))
  faceUpByLevel!: Record<DevelopmentLevel, number[]>;

  @hidden({
    schema: hiddenDeckSummarySchema,
    project(value) {
      const deckByLevel =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Partial<Record<DevelopmentLevel, number[]>>)
          : undefined;

      return {
        1: deckByLevel?.[1]?.length ?? 0,
        2: deckByLevel?.[2]?.length ?? 0,
        3: deckByLevel?.[3]?.length ?? 0,
      };
    },
  })
  @field(t.record(t.number(), t.array(t.number())))
  deckByLevel!: Record<DevelopmentLevel, number[]>;

  @field(t.array(t.number()))
  nobleIds!: number[];

  static createEmpty(): SplendorBoardState {
    const board = new SplendorBoardState();
    board.faceUpByLevel = {
      1: [],
      2: [],
      3: [],
    };
    board.deckByLevel = {
      1: [],
      2: [],
      3: [],
    };
    board.nobleIds = [];
    return board;
  }

  removeFaceUpCard(level: DevelopmentLevel, cardId: number): void {
    this.faceUpByLevel[level] = this.faceUpByLevel[level].filter(
      (faceUpCardId) => faceUpCardId !== cardId,
    );
  }

  replenishFaceUpCard(level: DevelopmentLevel): void {
    const nextCardId = this.deckByLevel[level].shift();

    if (nextCardId !== undefined) {
      this.faceUpByLevel[level].push(nextCardId);
    }
  }

  reserveDeckCard(level: DevelopmentLevel): number {
    const cardId = this.deckByLevel[level].shift();

    if (cardId === undefined) {
      throw new Error("deck_empty");
    }

    return cardId;
  }

  removeNoble(nobleId: number): void {
    this.nobleIds = this.nobleIds.filter(
      (currentNobleId) => currentNobleId !== nobleId,
    );
  }
}
