import type { KernelEvent } from "tabletop-kernel";
import { developmentCardsById } from "../data/cards.ts";
import { nobleTilesById } from "../data/nobles.ts";
import type {
  CardCost,
  DevelopmentCard,
  DevelopmentLevel,
  NobleTile,
} from "../data/types.ts";
import type { SplendorGameState } from "../state.ts";
import { PlayerOps } from "./player-ops.ts";

const TOKEN_COLOR_MAP = {
  White: "white",
  Blue: "blue",
  Green: "green",
  Red: "red",
  Black: "black",
} as const satisfies Record<keyof CardCost, string>;

export class SplendorGameOps {
  constructor(private readonly game: SplendorGameState) {}

  get state(): SplendorGameState {
    return this.game;
  }

  getPlayer(playerId: string): PlayerOps {
    const player = this.game.players[playerId];

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
    const index = this.game.playerOrder.indexOf(playerId);

    if (index === -1) {
      throw new Error(`unknown_player:${playerId}`);
    }

    return this.game.playerOrder[(index + 1) % this.game.playerOrder.length]!;
  }

  getLastPlayerId(): string {
    const lastPlayerId =
      this.game.playerOrder[this.game.playerOrder.length - 1];

    if (!lastPlayerId) {
      throw new Error("player_order_empty");
    }

    return lastPlayerId;
  }

  removeFaceUpCard(level: DevelopmentLevel, cardId: number): void {
    this.game.board.faceUpByLevel[level] = this.game.board.faceUpByLevel[
      level
    ].filter((faceUpCardId) => faceUpCardId !== cardId);
  }

  replenishFaceUpCard(level: DevelopmentLevel): void {
    const nextCardId = this.game.board.deckByLevel[level].shift();

    if (nextCardId !== undefined) {
      this.game.board.faceUpByLevel[level].push(nextCardId);
    }
  }

  reserveDeckCard(level: DevelopmentLevel): number {
    const cardId = this.game.board.deckByLevel[level].shift();

    if (cardId === undefined) {
      throw new Error("deck_empty");
    }

    return cardId;
  }

  getEligibleNobles(player: PlayerOps): NobleTile[] {
    const discounts = player.getDiscounts();

    return this.game.board.nobleIds
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
      this.removeNoble(noble.id);
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
    this.removeNoble(chosenNoble.id);
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

    if (!this.game.endGame && player.getScore() >= 15) {
      this.game.endGame = {
        triggeredByPlayerId: actorId,
        endsAfterPlayerId: this.getLastPlayerId(),
      };

      emitEvent({
        category: "runtime",
        type: "end_game_triggered",
        payload: {
          actorId,
          endsAfterPlayerId: this.game.endGame.endsAfterPlayerId,
        },
      });
    }

    if (this.game.endGame && actorId === this.game.endGame.endsAfterPlayerId) {
      this.finalizeWinners();
      emitEvent({
        category: "runtime",
        type: "game_finished",
        payload: {
          winnerIds: this.game.winnerIds,
        },
      });
    }
  }

  private removeNoble(nobleId: number): void {
    this.game.board.nobleIds = this.game.board.nobleIds.filter(
      (currentNobleId) => currentNobleId !== nobleId,
    );
  }

  private finalizeWinners(): void {
    const players = Object.values(this.game.players).map(
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

    this.game.winnerIds = highestScorers
      .filter(
        (player) =>
          player.state.purchasedCardIds.length === fewestPurchasedCards,
      )
      .map((player) => player.state.id);
  }
}
