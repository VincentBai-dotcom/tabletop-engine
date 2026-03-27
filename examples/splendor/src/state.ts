import type { KernelEvent } from "tabletop-kernel";
import { field, State, t } from "tabletop-kernel";
import { developmentCardsById } from "./data/cards.ts";
import { nobleTilesById } from "./data/nobles.ts";
import type {
  CardCost,
  DevelopmentCard,
  DevelopmentLevel,
  NobleTile,
} from "./data/types.ts";
import { PlayerOps } from "./model/player-ops.ts";

export const TOKEN_COLORS = [
  "white",
  "blue",
  "green",
  "red",
  "black",
  "gold",
] as const;

export const GEM_TOKEN_COLORS = TOKEN_COLORS.filter(
  (color) => color !== "gold",
) as readonly GemTokenColor[];

export type TokenColor = (typeof TOKEN_COLORS)[number];
export type GemTokenColor = Exclude<TokenColor, "gold">;

export interface TokenCounts {
  white: number;
  blue: number;
  green: number;
  red: number;
  black: number;
  gold: number;
}

export interface SplendorPlayerState {
  id: string;
  tokens: TokenCounts;
  reservedCardIds: number[];
  purchasedCardIds: number[];
  nobleIds: number[];
}

export interface EndGameState {
  triggeredByPlayerId: string;
  endsAfterPlayerId: string;
}

export interface SplendorGameState {
  playerOrder: string[];
  players: Record<string, SplendorPlayerState>;
  bank: TokenCounts;
  board: {
    faceUpByLevel: Record<DevelopmentLevel, number[]>;
    deckByLevel: Record<DevelopmentLevel, number[]>;
    nobleIds: number[];
  };
  endGame: EndGameState | null;
  winnerIds: string[] | null;
}

const TOKEN_COLOR_MAP = {
  White: "white",
  Blue: "blue",
  Green: "green",
  Red: "red",
  Black: "black",
} as const satisfies Record<keyof CardCost, GemTokenColor>;

@State()
export class SplendorBankStateFacade {
  @field(t.number())
  white!: number;

  @field(t.number())
  blue!: number;

  @field(t.number())
  green!: number;

  @field(t.number())
  red!: number;

  @field(t.number())
  black!: number;

  @field(t.number())
  gold!: number;

  adjustColor(color: TokenColor, amount: number): void {
    this[color] += amount;
  }

  applyDelta(delta: Partial<Record<TokenColor, number>>, multiplier = 1): void {
    for (const color of TOKEN_COLORS) {
      this.adjustColor(color, (delta[color] ?? 0) * multiplier);
    }
  }
}

@State()
export class SplendorBoardStateFacade {
  @field(t.record(t.number(), t.array(t.number())))
  faceUpByLevel!: Record<DevelopmentLevel, number[]>;

  @field(t.record(t.number(), t.array(t.number())))
  deckByLevel!: Record<DevelopmentLevel, number[]>;

  @field(t.array(t.number()))
  nobleIds!: number[];

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

@State()
export class SplendorEndGameStateFacade {
  @field(t.string())
  triggeredByPlayerId!: string;

  @field(t.string())
  endsAfterPlayerId!: string;
}

@State()
export class SplendorGameStateFacade {
  @field(t.array(t.string()))
  playerOrder!: string[];

  @field(t.record(t.string(), t.data<SplendorPlayerState>()))
  players!: Record<string, SplendorPlayerState>;

  @field(t.state(() => SplendorBankStateFacade))
  bank!: SplendorBankStateFacade;

  @field(t.state(() => SplendorBoardStateFacade))
  board!: SplendorBoardStateFacade;

  @field(t.state(() => SplendorEndGameStateFacade))
  endGame!: SplendorEndGameStateFacade | null;

  @field(t.array(t.string()))
  winnerIds!: string[] | null;

  getPlayer(playerId: string): PlayerOps {
    const player = this.players[playerId];

    if (!player) {
      throw new Error(`unknown_player:${playerId}`);
    }

    return new PlayerOps(player);
  }

  getCard(cardId: number): DevelopmentCard {
    const card = developmentCardsById[cardId];

    if (!card) {
      throw new Error(`unknown_card:${cardId}`);
    }

    return card;
  }

  getNextPlayerId(playerId: string): string {
    const index = this.playerOrder.indexOf(playerId);

    if (index === -1) {
      throw new Error(`unknown_player:${playerId}`);
    }

    return this.playerOrder[(index + 1) % this.playerOrder.length]!;
  }

  getLastPlayerId(): string {
    const lastPlayerId = this.playerOrder[this.playerOrder.length - 1];

    if (!lastPlayerId) {
      throw new Error("player_order_empty");
    }

    return lastPlayerId;
  }

  getEligibleNobles(player: PlayerOps): NobleTile[] {
    const discounts = player.getDiscounts();

    return this.board.nobleIds
      .map((nobleId) => nobleTilesById[nobleId])
      .filter((noble): noble is NobleTile => noble !== undefined)
      .filter((noble) =>
        Object.keys(TOKEN_COLOR_MAP).every((costColor) => {
          const colorKey = costColor as keyof CardCost;
          return discounts[colorKey] >= noble.requirements[colorKey];
        }),
      );
  }

  resolveNobleVisit(player: PlayerOps, chosenNobleId?: number): number | null {
    const eligibleNobles = this.getEligibleNobles(player);

    if (eligibleNobles.length === 0) {
      return null;
    }

    if (eligibleNobles.length === 1) {
      const noble = eligibleNobles[0]!;
      player.claimNoble(noble.id);
      this.board.removeNoble(noble.id);
      return noble.id;
    }

    if (!chosenNobleId) {
      throw new Error("chosen_noble_required");
    }

    const chosenNoble = eligibleNobles.find(
      (noble) => noble.id === chosenNobleId,
    );

    if (!chosenNoble) {
      throw new Error("invalid_chosen_noble");
    }

    player.claimNoble(chosenNoble.id);
    this.board.removeNoble(chosenNoble.id);
    return chosenNoble.id;
  }

  resolveTurnEnd(
    actorId: string,
    emitEvent: (event: KernelEvent) => void,
    chosenNobleId?: number,
  ): void {
    const player = this.getPlayer(actorId);
    const claimedNobleId = this.resolveNobleVisit(player, chosenNobleId);

    if (claimedNobleId !== null) {
      emitEvent({
        category: "domain",
        type: "noble_claimed",
        payload: {
          actorId,
          nobleId: claimedNobleId,
        },
      });
    }

    if (!this.endGame && player.getScore() >= 15) {
      this.endGame = {
        triggeredByPlayerId: actorId,
        endsAfterPlayerId: this.getLastPlayerId(),
      };

      emitEvent({
        category: "runtime",
        type: "end_game_triggered",
        payload: {
          actorId,
          endsAfterPlayerId: this.endGame.endsAfterPlayerId,
        },
      });
    }

    if (this.endGame && actorId === this.endGame.endsAfterPlayerId) {
      this.finalizeWinners();
      emitEvent({
        category: "runtime",
        type: "game_finished",
        payload: {
          winnerIds: this.winnerIds,
        },
      });
    }
  }

  private finalizeWinners(): void {
    const players = Object.values(this.players).map(
      (player) => new PlayerOps(player),
    );
    const highestScore = Math.max(
      ...players.map((player) => player.getScore()),
    );
    const highestScorers = players.filter(
      (player) => player.getScore() === highestScore,
    );
    const fewestPurchasedCards = Math.min(
      ...highestScorers.map((player) => player.state.purchasedCardIds.length),
    );

    this.winnerIds = highestScorers
      .filter(
        (player) =>
          player.state.purchasedCardIds.length === fewestPurchasedCards,
      )
      .map((player) => player.state.id);
  }
}

export type ReturnTokensPayload = Partial<TokenCounts>;

export interface TakeThreeDistinctGemsPayload {
  colors: [GemTokenColor, GemTokenColor, GemTokenColor];
  returnTokens?: ReturnTokensPayload;
}

export interface TakeTwoSameGemsPayload {
  color: GemTokenColor;
  returnTokens?: ReturnTokensPayload;
}

export interface ReserveFaceUpCardPayload {
  level: DevelopmentLevel;
  cardId: number;
  returnTokens?: ReturnTokensPayload;
}

export interface ReserveDeckCardPayload {
  level: DevelopmentLevel;
  returnTokens?: ReturnTokensPayload;
}

export interface BuyFaceUpCardPayload {
  level: DevelopmentLevel;
  cardId: number;
  chosenNobleId?: number;
}

export interface BuyReservedCardPayload {
  cardId: number;
  chosenNobleId?: number;
}
