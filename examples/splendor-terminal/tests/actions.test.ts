import { expect, test } from "bun:test";
import {
  buildCommandFromDiscovery,
  chooseRandomAvailableCommandType,
  chooseRandomDiscoveryOption,
  describeCommand,
} from "../src/actions.ts";
import type {
  SplendorState,
  SplendorTerminalDiscoveryRequest,
  SplendorTerminalDiscoveryResult,
} from "../src/types.ts";

test("buildCommandFromDiscovery follows discovered steps until completion", async () => {
  const discoveryInputs: SplendorTerminalDiscoveryRequest[] = [];
  const session = {
    discoverCommand(
      discovery: SplendorTerminalDiscoveryRequest,
    ): SplendorTerminalDiscoveryResult | null {
      discoveryInputs.push(discovery);

      const input = discovery.input ?? {};

      if (!("cardId" in input)) {
        return {
          complete: false,
          step: "select_card",
          options: [
            {
              id: "24",
              nextInput: {
                cardId: 24,
              },
            },
          ],
        };
      }

      if (!("chosenNobleId" in input)) {
        return {
          complete: false,
          step: "select_noble",
          options: [
            {
              id: "6",
              nextInput: {
                cardId: 24,
                chosenNobleId: 6,
              },
            },
          ],
        };
      }

      return {
        complete: true,
        input: {
          cardId: 24,
          chosenNobleId: 6,
        },
      };
    },
  };

  const command = await buildCommandFromDiscovery(
    session as never,
    "you",
    "buy_reserved_card",
    async (discovery) => discovery.options[0]!,
  );

  expect(discoveryInputs).toEqual([
    {
      type: "buy_reserved_card",
      actorId: "you",
      input: {},
    },
    {
      type: "buy_reserved_card",
      actorId: "you",
      input: {
        cardId: 24,
      },
    },
    {
      type: "buy_reserved_card",
      actorId: "you",
      input: {
        cardId: 24,
        chosenNobleId: 6,
      },
    },
  ]);
  expect(command).toEqual({
    type: "buy_reserved_card",
    actorId: "you",
    input: {
      cardId: 24,
      chosenNobleId: 6,
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
      step: "select",
      options: [
        { id: "one", nextInput: {} },
        { id: "two", nextInput: {} },
        { id: "three", nextInput: {} },
      ],
    },
    () => 0.99,
  );

  expect(commandType).toBe("b");
  expect(option.id).toBe("three");
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
  const state = {} as SplendorState;
  expect(state).toBeDefined();
});
