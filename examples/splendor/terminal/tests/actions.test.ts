import { expect, test } from "bun:test";
import {
  buildCommandFromDiscovery,
  chooseRandomAvailableCommandType,
  chooseRandomDiscoveryOption,
  describeCommand,
  describeDiscoveryOption,
} from "../src/actions.ts";
import { createLocalSplendorSession } from "../src/session.ts";
import { SPLENDOR_DISCOVERY_STEPS } from "splendor-example";
import type {
  SplendorTerminalDiscoveryRequest,
  SplendorTerminalDiscoveryOption,
  SplendorTerminalDiscoveryResult,
  SplendorTerminalOpenDiscovery,
} from "../src/types.ts";

test("buildCommandFromDiscovery follows discovered steps until completion", async () => {
  const discoveryInputs: SplendorTerminalDiscoveryRequest[] = [];
  const session = {
    discoverCommand(
      discovery: SplendorTerminalDiscoveryRequest,
    ): SplendorTerminalDiscoveryResult | null {
      discoveryInputs.push(discovery);

      if (discovery.step === SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard) {
        return {
          complete: false,
          step: SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard,
          options: [
            {
              id: "1:45",
              output: {
                cardId: 45,
                level: 1,
                bonusColor: "White",
                prestigePoints: 1,
                source: "face_up",
              },
              nextInput: {
                selectedLevel: 1,
                selectedCardId: 45,
              },
              nextStep: SPLENDOR_DISCOVERY_STEPS.selectReturnToken,
            },
          ],
        } as SplendorTerminalDiscoveryResult;
      }

      if (discovery.step === SPLENDOR_DISCOVERY_STEPS.selectReturnToken) {
        return {
          complete: true,
          input: {
            level: 1,
            cardId: 45,
          },
        } as SplendorTerminalDiscoveryResult;
      }

      return {
        complete: true,
        input: {
          level: 1,
          cardId: 45,
        },
      } as SplendorTerminalDiscoveryResult;
    },
  };

  const command = await buildCommandFromDiscovery(
    session as never,
    "you",
    "reserve_face_up_card",
    async (discovery) => discovery.options[0]!,
  );

  expect(discoveryInputs).toEqual([
    {
      type: "reserve_face_up_card",
      actorId: "you",
      step: SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard,
      input: {},
    },
    {
      type: "reserve_face_up_card",
      actorId: "you",
      step: SPLENDOR_DISCOVERY_STEPS.selectReturnToken,
      input: {
        selectedLevel: 1,
        selectedCardId: 45,
      },
    },
  ]);
  expect(command).toEqual({
    type: "reserve_face_up_card",
    actorId: "you",
    input: {
      level: 1,
      cardId: 45,
    },
  });
});

test("chooseRandom helpers use the provided random function", () => {
  const session = {
    listAvailableCommands(): string[] {
      return ["a", "b", "c"];
    },
  };

  const commandType = chooseRandomAvailableCommandType(
    session as never,
    "bot-1",
    () => 0.5,
  );
  const option = chooseRandomDiscoveryOption(
    {
      complete: false,
      step: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
      options: [
        {
          id: "one",
          output: { color: "white", selectedCount: 1, requiredCount: 3 },
          nextInput: { selectedColors: ["white"] },
          nextStep: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
        },
        {
          id: "two",
          output: { color: "blue", selectedCount: 1, requiredCount: 3 },
          nextInput: { selectedColors: ["blue"] },
          nextStep: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
        },
        {
          id: "three",
          output: { color: "green", selectedCount: 1, requiredCount: 3 },
          nextInput: { selectedColors: ["green"] },
          nextStep: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
        },
      ],
    },
    () => 0.99,
  );

  expect(commandType).toBe("b");
  expect(option.id).toBe("three");
});

test("describeDiscoveryOption renders the discovery output metadata", () => {
  const discovery = {
    complete: false,
    step: SPLENDOR_DISCOVERY_STEPS.selectNoble,
    options: [],
  } as SplendorTerminalOpenDiscovery;

  const option: SplendorTerminalDiscoveryOption = {
    id: "6",
    output: {
      nobleId: 6,
      name: "Henry VIII, King of England",
      requirements: {
        White: 0,
        Blue: 0,
        Black: 4,
        Red: 4,
        Green: 0,
      },
    },
    nextInput: {
      chosenNobleId: 6,
    },
    nextStep: SPLENDOR_DISCOVERY_STEPS.selectNoble,
  };

  expect(describeDiscoveryOption(discovery, option)).toBe(
    "Henry VIII, King of England",
  );
});

test("describeDiscoveryOption renders two-same-gem choices by amount", () => {
  const discovery = {
    complete: false,
    step: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
    options: [],
  } as SplendorTerminalOpenDiscovery;

  const option: SplendorTerminalDiscoveryOption = {
    id: "red",
    output: {
      color: "red",
      amount: 2,
    },
    nextInput: {
      selectedColor: "red",
    },
    nextStep: SPLENDOR_DISCOVERY_STEPS.selectReturnToken,
  };

  expect(describeDiscoveryOption(discovery, option)).toBe("Take 2 red");
});

test("buildCommandFromDiscovery fails closed when discovery is unavailable", async () => {
  const session = {
    discoverCommand(): SplendorTerminalDiscoveryResult | null {
      return null;
    },
  };

  await expect(
    buildCommandFromDiscovery(
      session as never,
      "you",
      "buy_reserved_card",
      async () => {
        throw new Error("should_not_be_called");
      },
    ),
  ).rejects.toThrow("discovery_unavailable:buy_reserved_card");
});

test("describeCommand renders splendor-specific summaries", () => {
  expect(
    describeCommand({
      type: "take_three_distinct_gems",
      actorId: "you",
      input: {
        colors: ["white", "blue", "green"],
      },
    }),
  ).toBe("Take gems white, blue, green");
});

test("render helper types remain compatible with session state shape", () => {
  const session = createLocalSplendorSession({
    seed: "session-seed",
  });

  expect(session).toBeDefined();
});
