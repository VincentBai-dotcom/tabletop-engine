import type { CommandDiscoveryResult } from "tabletop-kernel";
import {
  TOKEN_COLORS,
  type ReturnTokensPayload,
  type TokenCounts,
} from "./state.ts";
import type { NobleTile } from "./data/types.ts";

export const SPLENDOR_DISCOVERY_STEPS = {
  complete: "complete",
  selectFaceUpCard: "select_face_up_card",
  selectDeckLevel: "select_deck_level",
  selectReservedCard: "select_reserved_card",
  selectGemColor: "select_gem_color",
  selectReturnToken: "select_return_token",
  selectNoble: "select_noble",
} as const;

export type SplendorDiscoveryStep =
  (typeof SPLENDOR_DISCOVERY_STEPS)[keyof typeof SPLENDOR_DISCOVERY_STEPS];

export interface SplendorDiscoveryOption<
  TPayload extends Record<string, unknown>,
> {
  id: string;
  value: TPayload;
  metadata?: Record<string, unknown>;
}

export type SplendorDiscoveryResult<TPayload extends Record<string, unknown>> =
  CommandDiscoveryResult<SplendorDiscoveryOption<TPayload>>;

export function completeDiscovery<TPayload extends Record<string, unknown>>(
  payload: TPayload,
): SplendorDiscoveryResult<TPayload> {
  void payload;

  return {
    step: SPLENDOR_DISCOVERY_STEPS.complete,
    options: [],
    complete: true,
  };
}

export function createReturnTokenDiscovery<
  TPayload extends {
    returnTokens?: ReturnTokensPayload;
  } & Record<string, unknown>,
>(
  payload: TPayload,
  availableTokens: TokenCounts,
  requiredReturnCount: number,
): SplendorDiscoveryResult<TPayload> | null {
  const currentReturnTokens = payload.returnTokens ?? {};
  const selectedCount = sumReturnTokens(currentReturnTokens);

  if (selectedCount >= requiredReturnCount) {
    return null;
  }

  return {
    step: SPLENDOR_DISCOVERY_STEPS.selectReturnToken,
    options: TOKEN_COLORS.filter(
      (color) => availableTokens[color] > (currentReturnTokens[color] ?? 0),
    ).map((color) => ({
      id: color,
      value: {
        ...payload,
        returnTokens: {
          ...currentReturnTokens,
          [color]: (currentReturnTokens[color] ?? 0) + 1,
        },
      },
      metadata: {
        color,
        requiredReturnCount,
        selectedCount,
      },
    })),
    metadata: {
      requiredReturnCount,
      selectedCount,
    },
  };
}

export function createNobleDiscovery<
  TPayload extends {
    chosenNobleId?: number;
  } & Record<string, unknown>,
>(
  payload: TPayload,
  eligibleNobles: readonly NobleTile[],
): SplendorDiscoveryResult<TPayload> | null {
  if (eligibleNobles.length <= 1) {
    return null;
  }

  return {
    step: SPLENDOR_DISCOVERY_STEPS.selectNoble,
    options: eligibleNobles.map((noble) => ({
      id: String(noble.id),
      value: {
        ...payload,
        chosenNobleId: noble.id,
      },
      metadata: {
        nobleId: noble.id,
        name: noble.name,
      },
    })),
  };
}

function sumReturnTokens(tokens: ReturnTokensPayload): number {
  return TOKEN_COLORS.reduce((total, color) => total + (tokens[color] ?? 0), 0);
}
