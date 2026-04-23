import type { SplendorTerminalSession } from "./session.ts";
import type {
  MenuOption,
  SplendorTerminalCommand,
  SplendorTerminalDiscoveryRequest,
  SplendorTerminalDiscoveryOption,
  SplendorTerminalOpenDiscovery,
} from "./types.ts";
import {
  buyFaceUpCardDiscoveryStart,
  buyReservedCardDiscoveryStart,
  chooseNobleDiscoveryStart,
  developmentCardsById,
  nobleTilesById,
  reserveDeckCardDiscoveryStart,
  reserveFaceUpCardDiscoveryStart,
  SPLENDOR_DISCOVERY_STEPS,
  takeThreeDistinctGemsDiscoveryStart,
  takeTwoSameGemsDiscoveryStart,
  type BuyReservedCardInput,
  type ChooseNobleInput,
  type ReserveDeckCardInput,
  type TakeThreeDistinctGemsInput,
  type TakeTwoSameGemsInput,
} from "splendor-example";

export const COMMAND_LABELS: Record<string, string> = {
  take_three_distinct_gems: "Take 3 distinct gems",
  take_two_same_gems: "Take 2 gems of the same color",
  reserve_face_up_card: "Reserve a face-up card",
  reserve_deck_card: "Reserve a card from a deck",
  buy_face_up_card: "Buy a face-up card",
  buy_reserved_card: "Buy a reserved card",
  choose_noble: "Choose a noble",
};

const DISCOVERY_STARTS = {
  take_three_distinct_gems: takeThreeDistinctGemsDiscoveryStart,
  take_two_same_gems: takeTwoSameGemsDiscoveryStart,
  reserve_face_up_card: reserveFaceUpCardDiscoveryStart,
  reserve_deck_card: reserveDeckCardDiscoveryStart,
  buy_face_up_card: buyFaceUpCardDiscoveryStart,
  buy_reserved_card: buyReservedCardDiscoveryStart,
  choose_noble: chooseNobleDiscoveryStart,
} satisfies Record<
  SplendorTerminalCommand["type"],
  Omit<SplendorTerminalDiscoveryRequest, "actorId">
>;

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
    discovery: SplendorTerminalOpenDiscovery,
  ) => Promise<SplendorTerminalDiscoveryOption>,
): Promise<SplendorTerminalCommand> {
  const normalizedCommandType = commandType as SplendorTerminalCommand["type"];
  const discoveryStart = DISCOVERY_STARTS[normalizedCommandType];

  let nextDiscovery = {
    ...discoveryStart,
    actorId,
  } as SplendorTerminalDiscoveryRequest;

  for (;;) {
    const discovery = session.discoverCommand(nextDiscovery);

    if (!discovery) {
      throw new Error(`discovery_unavailable:${commandType}`);
    }

    if (discovery.complete) {
      return {
        type: normalizedCommandType,
        actorId,
        input: discovery.input,
      } as SplendorTerminalCommand;
    }

    if (discovery.options.length === 0) {
      throw new Error(`no_discovery_options:${discovery.step}`);
    }

    const choice = await chooseOption(discovery);
    nextDiscovery = {
      type: normalizedCommandType,
      actorId,
      step: choice.nextStep as SplendorTerminalDiscoveryRequest["step"],
      input: choice.nextInput as SplendorTerminalDiscoveryRequest["input"],
    } as SplendorTerminalDiscoveryRequest;
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
  discovery: SplendorTerminalOpenDiscovery,
  random: () => number = Math.random,
): SplendorTerminalDiscoveryOption {
  if (discovery.options.length === 0) {
    throw new Error(`no_discovery_options:${discovery.step}`);
  }

  return pickRandom(
    discovery.options as readonly SplendorTerminalDiscoveryOption[],
    random,
  );
}

export function describeCommand(command: SplendorTerminalCommand): string {
  switch (command.type) {
    case "take_three_distinct_gems":
      return `Take gems ${readThreeGemColors(command).join(", ")}`;
    case "take_two_same_gems":
      return `Take 2 ${readTwoGemColor(command)} gems`;
    case "reserve_face_up_card":
      return `Reserve ${describeFaceUpCard(
        command.input as Record<string, unknown>,
      )}`;
    case "reserve_deck_card":
      return `Reserve a level ${readDeckLevel(command)} deck card`;
    case "buy_face_up_card":
      return `Buy ${describeFaceUpCard(
        command.input as Record<string, unknown>,
      )}`;
    case "buy_reserved_card":
      return `Buy reserved card ${String(readReservedCardId(command))}`;
    case "choose_noble":
      return `Choose noble ${describeNoble(
        (command.input as ChooseNobleInput).nobleId,
      )}`;
    default:
      return (
        COMMAND_LABELS[(command as { type: string }).type] ??
        (command as { type: string }).type
      );
  }
}

export function describeDiscoveryPrompt(
  discovery: SplendorTerminalOpenDiscovery,
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
    default:
      return (discovery as { step: string }).step;
  }
}

export function describeDiscoveryOption(
  discovery: SplendorTerminalOpenDiscovery,
  option: SplendorTerminalDiscoveryOption,
): string {
  switch (discovery.step) {
    case SPLENDOR_DISCOVERY_STEPS.selectGemColor: {
      const output = option.output as {
        color: string;
        amount?: number;
        selectedCount?: number;
        requiredCount?: number;
      };

      if (typeof output.amount === "number") {
        return `Take ${String(output.amount)} ${String(output.color)}`;
      }

      return `Take ${String(output.color)} (${String(
        output.selectedCount,
      )}/${String(output.requiredCount)})`;
    }
    case SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard: {
      const output = option.output as {
        level: number;
        cardId: number;
        bonusColor: string;
        prestigePoints: number;
      };

      return `L${String(output.level)} #${String(output.cardId)} ${String(
        output.bonusColor,
      )} ${String(output.prestigePoints)}pt`;
    }
    case SPLENDOR_DISCOVERY_STEPS.selectDeckLevel: {
      const output = option.output as {
        level: number;
        cardCount: number;
      };

      return `Level ${String(output.level)} deck (${String(
        output.cardCount,
      )} cards)`;
    }
    case SPLENDOR_DISCOVERY_STEPS.selectReservedCard: {
      const output = option.output as {
        level: number;
        cardId: number;
        bonusColor: string;
        prestigePoints: number;
      };

      return `L${String(output.level)} #${String(output.cardId)} ${String(
        output.bonusColor,
      )} ${String(output.prestigePoints)}pt`;
    }
    case SPLENDOR_DISCOVERY_STEPS.selectReturnToken: {
      const output = option.output as {
        color: string;
        selectedCount: number;
        requiredReturnCount: number;
      };

      return `Return ${String(output.color)} (${String(
        output.selectedCount,
      )}/${String(output.requiredReturnCount)})`;
    }
    case SPLENDOR_DISCOVERY_STEPS.selectNoble: {
      const output = option.output as {
        name: string;
      };

      return String(output.name);
    }
    default:
      return (option as { id: string }).id;
  }
}

function pickRandom<T>(items: readonly T[], random: () => number): T {
  const index = Math.floor(random() * items.length);
  return items[index]!;
}

function describeFaceUpCard(input: Record<string, unknown>): string {
  const cardId = readCardId(input);
  const level = readLevel(input);

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
  const input = command.input as TakeThreeDistinctGemsInput | undefined;
  return input?.colors ? [...input.colors] : [];
}

function readTwoGemColor(command: SplendorTerminalCommand): string | "unknown" {
  const input = command.input as TakeTwoSameGemsInput | undefined;
  return input?.color ?? "unknown";
}

function readDeckLevel(command: SplendorTerminalCommand): number | "unknown" {
  const input = command.input as ReserveDeckCardInput | undefined;
  return input?.level ?? "unknown";
}

function readReservedCardId(
  command: SplendorTerminalCommand,
): number | "unknown" {
  const input = command.input as BuyReservedCardInput | undefined;
  return input?.cardId ?? "unknown";
}

function readCardId(input: Record<string, unknown>): number {
  return (
    (input.cardId as number | undefined) ??
    (input.selectedCardId as number | undefined) ??
    -1
  );
}

function readLevel(input: Record<string, unknown>): number {
  return (
    (input.level as number | undefined) ??
    (input.selectedLevel as number | undefined) ??
    -1
  );
}

export function describeNoble(nobleId: number): string {
  const noble = nobleTilesById[nobleId];
  return noble ? noble.name : `Noble ${String(nobleId)}`;
}
