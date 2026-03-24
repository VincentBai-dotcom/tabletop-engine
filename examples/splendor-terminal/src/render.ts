import type { KernelEvent } from "tabletop-kernel";
import {
  DEVELOPMENT_LEVELS,
  developmentCardsById,
  nobleTilesById,
  TOKEN_COLORS,
  type SplendorGameState,
  type SplendorPlayerState,
  type TokenColor,
} from "splendor-example";
import type { SessionActivity } from "./types.ts";

const BONUS_COLOR_KEYS = ["White", "Blue", "Green", "Red", "Black"] as const;

export function renderGameScreen(options: {
  game: SplendorGameState;
  activePlayerId: string | null;
  activity: SessionActivity;
  banner: string;
}): string {
  const { game, activePlayerId, activity, banner } = options;
  const sections = [
    `Splendor Terminal`,
    banner,
    `Active player: ${activePlayerId ?? "none"}`,
    "",
    `Bank: ${renderTokenCounts(game.bank)}`,
    "",
    "Nobles:",
    ...renderNobles(game.board.nobleIds),
    "",
    "Market:",
    ...renderMarket(game),
    "",
    "Players:",
    ...renderPlayers(game),
    "",
    "Your reserved cards:",
    ...renderReservedCards(game.players.you),
    "",
    "Recent activity:",
    ...renderActivity(activity),
  ];

  return sections.join("\n");
}

function renderNobles(nobleIds: readonly number[]): string[] {
  if (nobleIds.length === 0) {
    return ["  none"];
  }

  return nobleIds.map((nobleId) => {
    const noble = nobleTilesById[nobleId];

    if (!noble) {
      return `  #${String(nobleId)}`;
    }

    return `  #${String(noble.id)} ${noble.name} (${renderCardCost(
      noble.requirements,
    )})`;
  });
}

function renderMarket(game: SplendorGameState): string[] {
  return DEVELOPMENT_LEVELS.flatMap((level) => {
    const cards = game.board.faceUpByLevel[level]
      .map((cardId) => {
        const card = developmentCardsById[cardId];

        if (!card) {
          return `#${String(cardId)}`;
        }

        return `#${String(card.id)} ${card.bonusColor} ${card.prestigePoints}pt [${renderCardCost(
          card.cost,
        )}]`;
      })
      .join(" | ");

    return [`  Level ${String(level)}: ${cards || "empty"}`];
  });
}

function renderPlayers(game: SplendorGameState): string[] {
  return game.playerOrder.map((playerId) => {
    const player = game.players[playerId]!;
    const discounts = computeDiscounts(player);
    const score = computeScore(player);

    return `  ${player.id}: ${String(score)} pts | tokens ${renderTokenCounts(
      player.tokens,
    )} | bonuses ${renderBonusCounts(discounts)} | reserved ${String(
      player.reservedCardIds.length,
    )} | purchased ${String(player.purchasedCardIds.length)} | nobles ${String(
      player.nobleIds.length,
    )}`;
  });
}

function renderReservedCards(
  player: SplendorPlayerState | undefined,
): string[] {
  if (!player || player.reservedCardIds.length === 0) {
    return ["  none"];
  }

  return player.reservedCardIds.map((cardId) => {
    const card = developmentCardsById[cardId];

    if (!card) {
      return `  #${String(cardId)}`;
    }

    return `  #${String(card.id)} L${String(card.level)} ${card.bonusColor} ${card.prestigePoints}pt [${renderCardCost(
      card.cost,
    )}]`;
  });
}

function renderActivity(activity: SessionActivity): string[] {
  const lines: string[] = [];

  if (activity.summary) {
    lines.push(`  ${activity.summary}`);
  }

  if (activity.error) {
    lines.push(`  Error: ${activity.error}`);
  }

  if (activity.events.length === 0) {
    lines.push("  none");
    return lines;
  }

  for (const event of activity.events.slice(-8)) {
    lines.push(`  ${formatEvent(event)}`);
  }

  return lines;
}

function formatEvent(event: KernelEvent): string {
  if (!event.payload || Object.keys(event.payload).length === 0) {
    return event.type;
  }

  return `${event.type} ${JSON.stringify(event.payload)}`;
}

function renderTokenCounts(tokens: Record<TokenColor, number>): string {
  return TOKEN_COLORS.map((color) => `${color}:${String(tokens[color])}`).join(
    " ",
  );
}

function renderBonusCounts(
  discounts: Record<(typeof BONUS_COLOR_KEYS)[number], number>,
): string {
  return BONUS_COLOR_KEYS.map(
    (color) => `${color}:${String(discounts[color])}`,
  ).join(" ");
}

function renderCardCost(
  cost: Record<(typeof BONUS_COLOR_KEYS)[number], number>,
): string {
  return BONUS_COLOR_KEYS.filter((color) => cost[color] > 0)
    .map((color) => `${color}:${String(cost[color])}`)
    .join(" ");
}

function computeDiscounts(
  player: SplendorPlayerState,
): Record<(typeof BONUS_COLOR_KEYS)[number], number> {
  const totals = {
    White: 0,
    Blue: 0,
    Green: 0,
    Red: 0,
    Black: 0,
  };

  for (const cardId of player.purchasedCardIds) {
    const card = developmentCardsById[cardId];

    if (card) {
      const bonusColor = card.bonusColor as keyof typeof totals;
      totals[bonusColor] += 1;
    }
  }

  return totals;
}

function computeScore(player: SplendorPlayerState): number {
  const cardScore = player.purchasedCardIds.reduce((total, cardId) => {
    const card = developmentCardsById[cardId];
    return total + (card?.prestigePoints ?? 0);
  }, 0);

  return cardScore + player.nobleIds.length * 3;
}
