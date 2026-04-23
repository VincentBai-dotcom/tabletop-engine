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

test("chained builder supports step-authored discovery", () => {
  const defineCommand = createCommandFactory<{
    score: number;
  }>();
  const commandSchema = t.object({
    amount: t.number(),
  });
  const selectAmountInputSchema = t.object({});
  const selectAmountOutputSchema = t.object({
    label: t.string(),
    amount: t.number(),
  });

  const command = defineCommand({
    commandId: "gain_score",
    commandSchema,
  })
    .discoverable((flow) =>
      flow.step("select_amount", (step) =>
        step
          .input(selectAmountInputSchema)
          .output(selectAmountOutputSchema)
          .resolve(() => [
            {
              id: "one",
              output: {
                label: "One",
                amount: 1,
              },
              nextInput: {
                amount: 1,
              },
            },
          ]),
      ),
    )
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
  expect(command.discovery).toBeDefined();
  expect(command.discovery?.startStep).toBe("select_amount");
  expect(command.discovery?.steps).toHaveLength(1);
  expect(command.discovery?.steps[0]?.stepId).toBe("select_amount");
  expect(command.discovery?.steps[0]?.inputSchema).toBe(
    selectAmountInputSchema,
  );
  expect(command.discovery?.steps[0]?.outputSchema).toBe(
    selectAmountOutputSchema,
  );
  expect(command.discovery?.steps[0]?.resolve).toBeFunction();
  expect("discoverySchema" in command).toBeFalse();
  expect("discover" in command).toBeFalse();
});

test("chained builder supports ordered discovery steps and completion", () => {
  const defineCommand = createCommandFactory<{
    counter: number;
  }>();

  const incrementSchema = t.object({
    amount: t.number(),
  });
  const selectAmountInputSchema = t.object({});
  const selectAmountOutputSchema = t.object({
    amount: t.number(),
  });
  const selectTargetInputSchema = t.object({
    amount: t.number(),
  });
  const selectTargetOutputSchema = t.object({
    targetId: t.string(),
  });

  const discoverableCommand = defineCommand({
    commandId: "increment_with_discovery",
    commandSchema: incrementSchema,
  })
    .discoverable((flow) =>
      flow
        .step("select_amount", (step) =>
          step
            .input(selectAmountInputSchema)
            .output(selectAmountOutputSchema)
            .resolve(() => [
              {
                id: "one",
                output: {
                  amount: 1,
                },
                nextInput: {
                  amount: 1,
                },
              },
            ]),
        )
        .step("select_target", (step) =>
          step
            .input(selectTargetInputSchema)
            .output(selectTargetOutputSchema)
            .resolve(() => ({
              complete: true as const,
              input: {
                amount: 1,
              },
            })),
        ),
    )
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
    .discoverable((flow) =>
      flow.step("select_amount", (step) =>
        step
          .input(selectAmountInputSchema)
          .output(selectAmountOutputSchema)
          .resolve(() => ({
            complete: true as const,
            input: {
              amount: 1,
            },
          })),
      ),
    )
    .validate(({ command }) => {
      void command.input?.amount;
      return { ok: true as const };
    })
    .execute(({ game, command }) => {
      game.counter += command.input?.amount ?? 0;
    })
    .build();

  expect(discoverableCommand.commandId).toBe("increment_with_discovery");
  expect(mixedOrderCommand.commandId).toBe("increment_mixed_order");
  expect(discoverableCommand.discovery?.steps[0]?.defaultNextStep).toBe(
    "select_target",
  );
  expect(discoverableCommand.discovery?.steps[1]?.defaultNextStep).toBe(
    undefined,
  );
});
