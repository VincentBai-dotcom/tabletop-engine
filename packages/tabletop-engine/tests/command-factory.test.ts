import { expect, test } from "bun:test";
import { createCommandFactory, t } from "../src";

test("chained builder supports non-discoverable commands", () => {
  const defineCommand = createCommandFactory<{
    turns: number;
  }>();
  const passTurnSchema = t.object({});

  const command = defineCommand({
    commandId: "pass_turn",
    commandSchema: passTurnSchema,
  })
    .validate(({ game, command }) => {
      void game.turns;
      void command.input;
      return { ok: true as const };
    })
    .execute(({ game, command }) => {
      void command.input;
      game.turns += 1;
    })
    .build();

  expect(command.commandId).toBe("pass_turn");
  expect(command.commandSchema).toBe(passTurnSchema);
  expect(command.validate).toBeFunction();
  expect(command.execute).toBeFunction();
  expect("discoverySchema" in command).toBeFalse();
  expect("discover" in command).toBeFalse();
});

test("chained builder supports discoverable commands with typed discovery and command input", () => {
  const defineCommand = createCommandFactory<{
    score: number;
  }>();
  const commandSchema = t.object({
    amount: t.number(),
  });
  const discoverySchema = t.object({
    selectedAmount: t.optional(t.number()),
  });

  const command = defineCommand({
    commandId: "gain_score",
    commandSchema,
  })
    .discoverable({
      discoverySchema,
      discover({ discovery }) {
        if (typeof discovery.input?.selectedAmount !== "number") {
          return {
            complete: false as const,
            step: "select_amount",
            options: [
              {
                id: "one",
                nextInput: {
                  selectedAmount: 1,
                },
              },
            ],
          };
        }

        return {
          complete: true as const,
          input: {
            amount: discovery.input.selectedAmount,
          },
        };
      },
    })
    .isAvailable(({ game, runtime, actorId, commandType }) => {
      expect(typeof game.score).toBe("number");
      void runtime;
      void actorId;
      expect(commandType).toBe("gain_score");
      return true;
    })
    .validate(({ command }) => {
      expect(command.input?.amount).toBeNumber();
      return { ok: true as const };
    })
    .execute(({ game, command }) => {
      game.score += command.input?.amount ?? 0;
    })
    .build();

  expect(command.commandId).toBe("gain_score");
  expect(command.commandSchema).toBe(commandSchema);
  if (!("discoverySchema" in command)) {
    throw new Error("expected_discovery_schema");
  }
  expect(command.discoverySchema).toBe(discoverySchema);
  expect(command.discover).toBeFunction();
});

test("chained builder allows optional steps in flexible order", () => {
  const defineCommand = createCommandFactory<{
    counter: number;
  }>();

  const incrementSchema = t.object({
    amount: t.number(),
  });
  const incrementDiscoverySchema = t.object({
    selectedAmount: t.optional(t.number()),
  });

  const plainCommand = defineCommand({
    commandId: "increment",
    commandSchema: incrementSchema,
  })
    .validate(({ command }) => {
      void command.input?.amount;
      return { ok: true as const };
    })
    .execute(({ game, command }) => {
      game.counter += command.input?.amount ?? 0;
    })
    .build();

  const discoverableCommand = defineCommand({
    commandId: "increment_with_discovery",
    commandSchema: incrementSchema,
  })
    .discoverable({
      discoverySchema: incrementDiscoverySchema,
      discover({ discovery }) {
        if (typeof discovery.input?.selectedAmount !== "number") {
          return {
            complete: false as const,
            step: "select_amount",
            options: [
              {
                id: "one",
                nextInput: {
                  selectedAmount: 1,
                },
              },
            ],
          };
        }

        return {
          complete: true as const,
          input: {
            amount: discovery.input.selectedAmount,
          },
        };
      },
    })
    .validate(({ command }) => {
      void command.input?.amount;
      return { ok: true as const };
    })
    .execute(({ game, command }) => {
      game.counter += command.input?.amount ?? 0;
    })
    .build();

  const mixedOrderCommand = defineCommand({
    commandId: "increment_mixed_order",
    commandSchema: incrementSchema,
  })
    .isAvailable(() => true)
    .discoverable({
      discoverySchema: incrementDiscoverySchema,
      discover({ discovery }) {
        if (typeof discovery.input?.selectedAmount !== "number") {
          return {
            complete: false as const,
            step: "select_amount",
            options: [
              {
                id: "one",
                nextInput: {
                  selectedAmount: 1,
                },
              },
            ],
          };
        }

        return {
          complete: true as const,
          input: {
            amount: discovery.input.selectedAmount,
          },
        };
      },
    })
    .validate(({ command }) => {
      void command.input?.amount;
      return { ok: true as const };
    })
    .execute(({ game, command }) => {
      game.counter += command.input?.amount ?? 0;
    })
    .build();

  expect(plainCommand.commandId).toBe("increment");
  expect(discoverableCommand.commandId).toBe("increment_with_discovery");
  expect(mixedOrderCommand.commandId).toBe("increment_mixed_order");
});
