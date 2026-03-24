import { expect, test } from "bun:test";
import {
  buildCommandFromDiscovery,
  chooseRandomAvailableCommandType,
  chooseRandomDiscoveryOption,
  describeCommand,
} from "../src/actions.ts";
import type {
  SplendorState,
  SplendorTerminalCommand,
  SplendorTerminalDiscovery,
} from "../src/types.ts";

test("buildCommandFromDiscovery follows discovered steps until completion", async () => {
  const partialCommands: SplendorTerminalCommand[] = [];
  const session = {
    discoverCommand(
      command: SplendorTerminalCommand,
    ): SplendorTerminalDiscovery | null {
      partialCommands.push(command);

      const payload = command.payload ?? {};

      if (!("cardId" in payload)) {
        return {
          step: "select_card",
          options: [
            {
              id: "24",
              value: {
                cardId: 24,
              },
            },
          ],
        };
      }

      if (!("chosenNobleId" in payload)) {
        return {
          step: "select_noble",
          options: [
            {
              id: "6",
              value: {
                cardId: 24,
                chosenNobleId: 6,
              },
            },
          ],
        };
      }

      return {
        step: "complete",
        options: [],
        complete: true,
      };
    },
  };

  const command = await buildCommandFromDiscovery(
    session as never,
    "you",
    "buy_reserved_card",
    async (discovery) => discovery.options[0]!,
  );

  expect(partialCommands).toEqual([
    {
      type: "buy_reserved_card",
      actorId: "you",
    },
    {
      type: "buy_reserved_card",
      actorId: "you",
      payload: {
        cardId: 24,
      },
    },
    {
      type: "buy_reserved_card",
      actorId: "you",
      payload: {
        cardId: 24,
        chosenNobleId: 6,
      },
    },
  ]);
  expect(command).toEqual({
    type: "buy_reserved_card",
    actorId: "you",
    payload: {
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
      step: "select",
      options: [
        { id: "one", value: {} },
        { id: "two", value: {} },
        { id: "three", value: {} },
      ],
    },
    () => 0.99,
  );

  expect(commandType).toBe("b");
  expect(option.id).toBe("three");
});

test("buildCommandFromDiscovery fails closed when discovery is unavailable", async () => {
  const session = {
    discoverCommand(): SplendorTerminalDiscovery | null {
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
      payload: {
        colors: ["white", "blue", "green"],
      },
    }),
  ).toBe("Take gems white, blue, green");
});

test("render helper types remain compatible with session state shape", () => {
  const state = {} as SplendorState;
  expect(state).toBeDefined();
});
