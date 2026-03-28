import {
  TOKEN_COLORS,
  type SplendorPlayerState,
  type TokenColor,
  type TokenCounts,
} from "../state.ts";

interface MutableTokenContainer extends TokenCounts {
  applyDelta?(
    delta: Partial<Record<TokenColor, number>>,
    multiplier?: number,
  ): void;
  adjustColor?(color: TokenColor, amount: number): void;
}

export function emptyTokens(): TokenCounts {
  return {
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
    gold: 0,
  };
}

export function cloneTokens(tokens: TokenCounts): TokenCounts {
  return { ...tokens };
}

export function sumTokens(tokens: Partial<Record<TokenColor, number>>): number {
  return TOKEN_COLORS.reduce((total, color) => total + (tokens[color] ?? 0), 0);
}

export function getGemSupplyPerColor(playerCount: number): number {
  switch (playerCount) {
    case 2:
      return 4;
    case 3:
      return 5;
    case 4:
      return 7;
    default:
      throw new Error(`unsupported_player_count:${playerCount}`);
  }
}

export function createBank(playerCount: number): TokenCounts {
  const gemSupply = getGemSupplyPerColor(playerCount);

  return {
    white: gemSupply,
    blue: gemSupply,
    green: gemSupply,
    red: gemSupply,
    black: gemSupply,
    gold: 5,
  };
}

export function applyTokenDelta(
  target: MutableTokenContainer,
  delta: Partial<Record<TokenColor, number>>,
  multiplier = 1,
): void {
  if (typeof target.applyDelta === "function") {
    target.applyDelta(delta, multiplier);
    return;
  }

  for (const color of TOKEN_COLORS) {
    target[color] += (delta[color] ?? 0) * multiplier;
  }
}

export function validateReturnTokens(
  player: SplendorPlayerState,
  returnTokens: Partial<TokenCounts> | undefined,
  requiredReturnCount: number,
): boolean {
  const normalizedReturnTokens = returnTokens ?? {};

  if (sumTokens(normalizedReturnTokens) !== requiredReturnCount) {
    return false;
  }

  for (const color of TOKEN_COLORS) {
    const amount = normalizedReturnTokens[color] ?? 0;

    if (
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > player.tokens[color]
    ) {
      return false;
    }
  }

  return true;
}

export function applyReturnTokens(
  player: SplendorPlayerState,
  bank: MutableTokenContainer,
  returnTokens: Partial<TokenCounts> | undefined,
): void {
  if (!returnTokens) {
    return;
  }

  for (const color of TOKEN_COLORS) {
    const amount = returnTokens[color] ?? 0;
    player.tokens[color] -= amount;

    if (typeof bank.adjustColor === "function") {
      bank.adjustColor(color, amount);
      continue;
    }

    bank[color] += amount;
  }
}
