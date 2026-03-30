import type { SplendorTerminalSession } from "./session.ts";
import type {
  MenuOption,
  SplendorPayload,
  SplendorTerminalCommand,
  SplendorTerminalDiscovery,
  SplendorTerminalDiscoveryOption,
} from "./types.ts";
import {
  developmentCardsById,
  nobleTilesById,
  SPLENDOR_DISCOVERY_STEPS,
  type BuyFaceUpCardPayload,
  type BuyReservedCardPayload,
  type ReserveDeckCardPayload,
  type ReserveFaceUpCardPayload,
  type TakeThreeDistinctGemsPayload,
  type TakeTwoSameGemsPayload,
} from "splendor-example";

export const COMMAND_LABELS: Record<string, string> = {
  take_three_distinct_gems: "Take 3 distinct gems",
  take_two_same_gems: "Take 2 gems of the same color",
  reserve_face_up_card: "Reserve a face-up card",
  reserve_deck_card: "Reserve a card from a deck",
  buy_face_up_card: "Buy a face-up card",
  buy_reserved_card: "Buy a reserved card",
};

export function createCommandMenuOptions(
  commandTypes: readonly string[],
): MenuOption<string>[] {
  return commandTypes.map((commandType) => ({
    label: COMMAND_LABELS[commandType] ?? commandType,
    value: commandType,
  }));
}

export async function buildCommandFromDiscovery(
  session: SplendorTerminalSession,
  actorId: string,
  commandType: string,
  chooseOption: (
    discovery: SplendorTerminalDiscovery,
  ) => Promise<SplendorTerminalDiscoveryOption>,
): Promise<SplendorTerminalCommand> {
  let partialCommand: SplendorTerminalCommand = {
    type: commandType,
    actorId,
  };

  for (;;) {
    const discovery = session.discoverCommand(partialCommand);

    if (!discovery) {
      throw new Error(`discovery_unavailable:${commandType}`);
    }

    if (discovery.complete) {
      return partialCommand;
    }

    if (discovery.options.length === 0) {
      throw new Error(`no_discovery_options:${discovery.step}`);
    }

    const choice = await chooseOption(discovery);
    partialCommand = {
      ...partialCommand,
      payload: choice.value,
    };
  }
}

export function chooseRandomAvailableCommandType(
  session: SplendorTerminalSession,
  actorId: string,
  random: () => number = Math.random,
): string {
  const availableCommands = session.listAvailableCommands(actorId);

  if (availableCommands.length === 0) {
    throw new Error(`no_available_commands:${actorId}`);
  }

  return pickRandom(availableCommands, random);
}

export function chooseRandomDiscoveryOption(
  discovery: SplendorTerminalDiscovery,
  random: () => number = Math.random,
): SplendorTerminalDiscoveryOption {
  if (discovery.options.length === 0) {
    throw new Error(`no_discovery_options:${discovery.step}`);
  }

  return pickRandom(discovery.options, random);
}

export function describeCommand(command: SplendorTerminalCommand): string {
  switch (command.type) {
    case "take_three_distinct_gems":
      return `Take gems ${readThreeGemColors(command).join(", ")}`;
    case "take_two_same_gems":
      return `Take 2 ${readTwoGemColor(command)} gems`;
    case "reserve_face_up_card":
      return `Reserve ${describeFaceUpCard(
        command.payload as unknown as ReserveFaceUpCardPayload,
      )}`;
    case "reserve_deck_card":
      return `Reserve a level ${readDeckLevel(command)} deck card`;
    case "buy_face_up_card":
      return `Buy ${describeFaceUpCard(
        command.payload as unknown as BuyFaceUpCardPayload,
      )}`;
    case "buy_reserved_card":
      return `Buy reserved card ${String(readReservedCardId(command))}`;
    default:
      return COMMAND_LABELS[command.type] ?? command.type;
  }
}

export function describeDiscoveryPrompt(
  discovery: SplendorTerminalDiscovery,
): string {
  switch (discovery.step) {
    case SPLENDOR_DISCOVERY_STEPS.selectGemColor:
      return "Choose a gem color";
    case SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard:
      return "Choose a face-up card";
    case SPLENDOR_DISCOVERY_STEPS.selectDeckLevel:
      return "Choose a deck level";
    case SPLENDOR_DISCOVERY_STEPS.selectReservedCard:
      return "Choose a reserved card";
    case SPLENDOR_DISCOVERY_STEPS.selectReturnToken:
      return "Choose a token to return";
    case SPLENDOR_DISCOVERY_STEPS.selectNoble:
      return "Choose a noble to visit";
    case SPLENDOR_DISCOVERY_STEPS.complete:
      return "Command complete";
    default:
      return discovery.step;
  }
}

export function describeDiscoveryOption(
  discovery: SplendorTerminalDiscovery,
  option: SplendorTerminalDiscoveryOption,
): string {
  const metadata = option.metadata ?? {};

  switch (discovery.step) {
    case SPLENDOR_DISCOVERY_STEPS.selectGemColor:
      return `Take ${String(metadata.color ?? option.id)}`;
    case SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard:
      return describeCardSelection(option.value);
    case SPLENDOR_DISCOVERY_STEPS.selectDeckLevel:
      return `Level ${String(metadata.level ?? option.id)} deck`;
    case SPLENDOR_DISCOVERY_STEPS.selectReservedCard:
      return describeReservedCardSelection(option.value);
    case SPLENDOR_DISCOVERY_STEPS.selectReturnToken:
      return `Return ${String(metadata.color ?? option.id)}`;
    case SPLENDOR_DISCOVERY_STEPS.selectNoble:
      return String(metadata.name ?? option.id);
    default:
      return option.id;
  }
}

function pickRandom<T>(items: readonly T[], random: () => number): T {
  const index = Math.floor(random() * items.length);
  return items[index]!;
}

function describeCardSelection(payload: SplendorPayload): string {
  const cardId = readCardId(payload);
  const level = readLevel(payload);
  const card = developmentCardsById[cardId];

  if (!card) {
    return `Level ${String(level)} card ${String(cardId)}`;
  }

  return `L${String(level)} #${String(card.id)} ${card.bonusColor} ${card.prestigePoints}pt`;
}

function describeReservedCardSelection(payload: SplendorPayload): string {
  const cardId = readCardId(payload);
  const card = developmentCardsById[cardId];

  if (!card) {
    return `Reserved card ${String(cardId)}`;
  }

  return `#${String(card.id)} ${card.bonusColor} ${card.prestigePoints}pt`;
}

function describeFaceUpCard(
  payload: Partial<ReserveFaceUpCardPayload> | Partial<BuyFaceUpCardPayload>,
): string {
  const cardId = payload.cardId;
  const level = payload.level;

  if (typeof cardId !== "number" || typeof level !== "number") {
    return "face-up card";
  }

  const card = developmentCardsById[cardId];

  if (!card) {
    return `level ${String(level)} card ${String(cardId)}`;
  }

  return `L${String(level)} #${String(card.id)} ${card.bonusColor} ${card.prestigePoints}pt`;
}

function readThreeGemColors(command: SplendorTerminalCommand): string[] {
  const payload = command.payload as TakeThreeDistinctGemsPayload | undefined;
  return payload?.colors ? [...payload.colors] : [];
}

function readTwoGemColor(command: SplendorTerminalCommand): string | "unknown" {
  const payload = command.payload as TakeTwoSameGemsPayload | undefined;
  return payload?.color ?? "unknown";
}

function readDeckLevel(command: SplendorTerminalCommand): number | "unknown" {
  const payload = command.payload as ReserveDeckCardPayload | undefined;
  return payload?.level ?? "unknown";
}

function readReservedCardId(
  command: SplendorTerminalCommand,
): number | "unknown" {
  const payload = command.payload as BuyReservedCardPayload | undefined;
  return payload?.cardId ?? "unknown";
}

function readCardId(payload: SplendorPayload): number {
  return (payload.cardId as number | undefined) ?? -1;
}

function readLevel(payload: SplendorPayload): number {
  return (payload.level as number | undefined) ?? -1;
}

export function describeNoble(nobleId: number): string {
  const noble = nobleTilesById[nobleId];
  return noble ? noble.name : `Noble ${String(nobleId)}`;
}
