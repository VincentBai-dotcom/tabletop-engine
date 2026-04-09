import type {
  CanonicalStateOf,
  Command,
  CommandDiscoveryResult,
  Discovery,
  GameEvent,
  HiddenValue,
  VisibleState,
} from "tabletop-engine";
import type {
  SplendorDiscoveryOption,
  createSplendorGame,
} from "splendor-example";

type SplendorGameDefinition = ReturnType<typeof createSplendorGame>;
export type SplendorState = CanonicalStateOf<SplendorGameDefinition>;
export type HiddenCountSummary = HiddenValue<{
  count: number;
}>;
export type HiddenDeckSummary = HiddenValue<{
  1: number;
  2: number;
  3: number;
}>;

export interface SplendorVisiblePlayer {
  id: string;
  tokens: {
    white: number;
    blue: number;
    green: number;
    red: number;
    black: number;
    gold: number;
  };
  reservedCardIds: number[] | HiddenCountSummary;
  purchasedCardIds: number[];
  nobleIds: number[];
}

export interface SplendorVisibleGame {
  playerOrder: string[];
  players: Record<string, SplendorVisiblePlayer>;
  bank: {
    white: number;
    blue: number;
    green: number;
    red: number;
    black: number;
    gold: number;
  };
  board: {
    faceUpByLevel: Record<number, number[]>;
    deckByLevel: HiddenDeckSummary;
    nobleIds: number[];
  };
  endGame?: {
    triggeredByPlayerId: string;
    endsAfterPlayerId: string;
  };
  winnerIds?: string[];
}

export type SplendorVisibleState = VisibleState<SplendorVisibleGame>;
export type SplendorCommandData = Record<string, unknown>;
export type SplendorTerminalCommand = Command<SplendorCommandData>;
export type SplendorTerminalDiscoveryRequest = Discovery<SplendorCommandData>;
export type SplendorTerminalDiscoveryOption =
  SplendorDiscoveryOption<SplendorCommandData>;
export type SplendorTerminalDiscoveryResult = CommandDiscoveryResult<
  SplendorCommandData,
  SplendorCommandData
>;
export type SplendorTerminalOpenDiscovery = Extract<
  SplendorTerminalDiscoveryResult,
  { complete: false }
>;

export interface SessionActivity {
  command: SplendorTerminalCommand | null;
  events: GameEvent[];
  summary: string | null;
  error: string | null;
}

export interface MenuOption<T> {
  label: string;
  value: T;
}
