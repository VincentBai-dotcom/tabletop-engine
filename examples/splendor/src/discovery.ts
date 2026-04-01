import type { CommandDiscoveryResult } from "tabletop-engine";
import {
  TOKEN_COLORS,
  type ReturnTokensPayload,
  type TokenCountsState,
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
  TDiscoveryInput extends Record<string, unknown>,
> {
  id: string;
  nextInput: TDiscoveryInput;
  metadata?: Record<string, unknown>;
}

export type SplendorDiscoveryResult<
  TDiscoveryInput extends Record<string, unknown>,
  TCommandInput extends Record<string, unknown> = TDiscoveryInput,
> = CommandDiscoveryResult<TDiscoveryInput, TCommandInput>;

type IncompleteDiscoveryResult<
  TDiscoveryInput extends Record<string, unknown>,
> = Extract<
  SplendorDiscoveryResult<TDiscoveryInput, never>,
  { complete: false }
>;

export function completeDiscovery<
  TCommandInput extends Record<string, unknown>,
>(
  input: TCommandInput,
): Extract<
  SplendorDiscoveryResult<Record<string, unknown>, TCommandInput>,
  {
    complete: true;
  }
> {
  return {
    complete: true as const,
    input,
  };
}

export function createReturnTokenDiscovery<
  TDiscoveryInput extends {
    returnTokens?: ReturnTokensPayload;
  } & Record<string, unknown>,
>(
  input: TDiscoveryInput,
  availableTokens: TokenCountsState,
  requiredReturnCount: number,
): IncompleteDiscoveryResult<TDiscoveryInput> | null {
  const currentReturnTokens = input.returnTokens ?? {};
  const selectedCount = sumReturnTokens(currentReturnTokens);

  if (selectedCount >= requiredReturnCount) {
    return null;
  }

  return {
    complete: false as const,
    step: SPLENDOR_DISCOVERY_STEPS.selectReturnToken,
    options: TOKEN_COLORS.filter(
      (color) => availableTokens[color] > (currentReturnTokens[color] ?? 0),
    ).map((color) => ({
      id: color,
      nextInput: {
        ...input,
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
  TDiscoveryInput extends {
    chosenNobleId?: number;
  } & Record<string, unknown>,
>(
  input: TDiscoveryInput,
  eligibleNobles: readonly NobleTile[],
): IncompleteDiscoveryResult<TDiscoveryInput> | null {
  if (eligibleNobles.length <= 1) {
    return null;
  }

  return {
    complete: false as const,
    step: SPLENDOR_DISCOVERY_STEPS.selectNoble,
    options: eligibleNobles.map((noble) => ({
      id: String(noble.id),
      nextInput: {
        ...input,
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
