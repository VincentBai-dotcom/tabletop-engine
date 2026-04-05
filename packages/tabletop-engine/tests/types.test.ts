import { expect, test } from "bun:test";
import type {
  CommandAvailabilityContext,
  Command,
  CommandDiscoveryResult,
  CanonicalState,
  Discovery,
  DiscoveryContext,
  ExecutionResult,
  GameEvent,
  ProgressionCompletionContext,
  ProgressionDefinition,
  ProgressionLifecycleHookContext,
  ProgressionResolveNextResult,
  ValidationOutcome,
} from "../src/index";
import { createCommandFactory, t } from "../src/index";
import type {
  CommandFromSchema,
  InternalCommandDefinition,
  InternalExecuteContext,
} from "../src/types/command";
import type { RuntimeState } from "../src/types/state";

test("foundational runtime types compose", () => {
  const event: GameEvent = {
    category: "domain",
    type: "card_drawn",
    payload: { playerId: "p1", count: 1 },
  };

  const state: CanonicalState = {
    game: {},
    runtime: {
      progression: {
        current: null,
        rootId: null,
        segments: {},
      },
      rng: {
        seed: "seed",
        cursor: 0,
      },
      history: {
        entries: [],
      },
    },
  };

  const command: Command = {
    type: "draw_card",
    actorId: "p1",
    input: { count: 1 },
  };

  const result: ExecutionResult = {
    ok: true,
    state,
    events: [event],
  };

  const validation: ValidationOutcome = {
    ok: false,
    reason: "wrong_phase",
    metadata: { expectedPhase: "main" },
  };

  expect(event.category).toBe("domain");
  expect(state.runtime.progression.current).toBeNull();
  expect(command.type).toBe("draw_card");
  expect(result.ok).toBeTrue();
  expect(result.state).toBe(state);
  expect(validation.ok).toBeFalse();
});

test("progression lifecycle types support nested segment authoring", () => {
  const completionContext: ProgressionCompletionContext<
    { score: number },
    { progression: { current: string | null } },
    Command<{ amount: number }>
  > = {
    game: { score: 0 },
    runtime: {
      progression: {
        current: "turn",
      },
    },
    command: {
      type: "gain_score",
      actorId: "p1",
      input: { amount: 1 },
    },
    segment: {
      id: "turn",
      active: true,
      childIds: [],
    },
    progression: {
      byId: () => undefined,
      current: () => undefined,
      parent: () => undefined,
      activePath: () => [],
    },
  };

  const lifecycleContext: ProgressionLifecycleHookContext<
    { score: number },
    { progression: { current: string | null } },
    Command<{ amount: number }>
  > = {
    ...completionContext,
    rng: {
      number: () => 0,
      die: () => 1,
      shuffle: (items) => [...items],
    },
    emitEvent: () => {},
  };

  const next: ProgressionResolveNextResult = {
    nextSegmentId: "turn",
    ownerId: "player-2",
  };

  const progression: ProgressionDefinition<
    { score: number },
    { progression: { current: string | null } },
    Command<{ amount: number }>
  > = {
    root: {
      id: "round",
      children: [
        {
          id: "turn",
          kind: "turn",
          completionPolicy: "after_successful_command",
          onEnter: (context) => {
            context.game.score += 1;
          },
          onExit: (context) => {
            context.emitEvent({
              category: "domain",
              type: "turn_exited",
              payload: {},
            });
          },
          resolveNext: () => next,
          children: [],
        },
      ],
    },
  };

  expect(progression.root.children[0]?.id).toBe("turn");
  expect(lifecycleContext.segment.id).toBe("turn");
  expect(next.ownerId).toBe("player-2");
});

test("discovery types compose for draft-based next-step options and completion", () => {
  type PlayCardDiscoveryInput = {
    step: string;
    cardId?: number;
    targets?: number[];
  };

  type PlayCardInput = {
    cardId: number;
    targets?: number[];
  };

  const availabilityContext: CommandAvailabilityContext<{
    handCount: number;
  }> = {
    game: { handCount: 3 },
    runtime: {
      progression: { current: "turn", rootId: "turn", segments: {} },
      rng: { seed: "seed", cursor: 0 },
      history: { entries: [] },
    },
    commandType: "play_card",
    actorId: "p1",
  };

  const discoveryRequest: Discovery<PlayCardDiscoveryInput> = {
    type: "play_card",
    actorId: "p1",
    input: {
      step: "select_target",
      cardId: 12,
    },
  };

  const discoveryContext: DiscoveryContext<
    { handCount: number },
    PlayCardDiscoveryInput
  > = {
    ...availabilityContext,
    discovery: discoveryRequest,
  };

  const discoveryResult: CommandDiscoveryResult<
    PlayCardDiscoveryInput,
    PlayCardInput
  > = {
    complete: false,
    step: "select_target",
    options: [
      {
        id: "target-1",
        nextInput: {
          step: "complete",
          cardId: 12,
          targets: [101],
        },
      },
    ],
  };

  const completion: CommandDiscoveryResult<
    PlayCardDiscoveryInput,
    PlayCardInput
  > = {
    complete: true,
    input: {
      cardId: 12,
      targets: [101],
    },
  };

  expect(availabilityContext.actorId).toBe("p1");
  expect(discoveryContext.discovery.input).toEqual({
    step: "select_target",
    cardId: 12,
  });
  expect(discoveryResult.step).toBe("select_target");
  expect(discoveryResult.options[0]?.id).toBe("target-1");
  if (!discoveryResult.complete) {
    expect(discoveryResult.options[0]?.nextInput).toEqual({
      step: "complete",
      cardId: 12,
      targets: [101],
    });
  }
  if (completion.complete) {
    expect(completion.input).toEqual({
      cardId: 12,
      targets: [101],
    });
  }
});

test("strict command and discovery requests require actorId and input", () => {
  const command: Command<{ amount: number }> = {
    type: "gain_score",
    actorId: "p1",
    input: { amount: 2 },
  };

  const discovery: Discovery<{ selectedAmount: number }> = {
    type: "gain_score",
    actorId: "p1",
    input: { selectedAmount: 2 },
  };

  // @ts-expect-error command actorId is required
  const missingCommandActorId: Command<{ amount: number }> = {
    type: "gain_score",
    input: { amount: 2 },
  };

  // @ts-expect-error command input is required
  const missingCommandInput: Command<{ amount: number }> = {
    type: "gain_score",
    actorId: "p1",
  };

  // @ts-expect-error discovery actorId is required
  const missingDiscoveryActorId: Discovery<{ selectedAmount: number }> = {
    type: "gain_score",
    input: { selectedAmount: 2 },
  };

  // @ts-expect-error discovery input is required
  const missingDiscoveryInput: Discovery<{ selectedAmount: number }> = {
    type: "gain_score",
    actorId: "p1",
  };

  expect(command.actorId).toBe("p1");
  expect(command.input.amount).toBe(2);
  expect(discovery.actorId).toBe("p1");
  expect(discovery.input.selectedAmount).toBe(2);
  expect(missingCommandActorId).toBeDefined();
  expect(missingCommandInput).toBeDefined();
  expect(missingDiscoveryActorId).toBeDefined();
  expect(missingDiscoveryInput).toBeDefined();
});

test("consumer command definitions only expose game state and command input generics", () => {
  const defineCommand = createCommandFactory<{
    increment(): void;
  }>();
  const gainScoreCommandSchema = t.object({
    amount: t.number(),
  });

  const definition = defineCommand({
    commandId: "gain_score",
    commandSchema: gainScoreCommandSchema,
  })
    .discoverable({
      discoverySchema: t.object({
        amount: t.optional(t.number()),
      }),
      discover: ({ discovery }) => {
        if (typeof discovery.input?.amount !== "number") {
          return {
            complete: false as const,
            step: "select_amount",
            options: [
              {
                id: "amount-1",
                nextInput: { amount: 1 },
              },
            ],
          };
        }

        return {
          complete: true as const,
          input: {
            amount: discovery.input.amount,
          },
        };
      },
    })
    .validate(({ command }) => {
      const amount: number = command.input.amount;

      return {
        ok: typeof amount === "number",
        reason: "amount_required",
      };
    })
    .execute(({ game, command }) => {
      game.increment();
      const amount: number = command.input.amount;
      void amount;
    })
    .build();

  expect(definition.commandId).toBe("gain_score");
});

test("command factory contextually types command lifecycle methods", () => {
  const defineCommand = createCommandFactory<{
    score: number;
    increment(): void;
  }>();

  const commandSchema = t.object({
    amount: t.number(),
  });
  const draftSchema = t.object({
    selectedAmount: t.optional(t.number()),
  });

  const command = defineCommand({
    commandId: "gain_score",
    commandSchema,
  })
    .isAvailable(({ game, actorId, runtime, commandType }) => {
      expect(typeof game.score).toBe("number");
      void game.increment;
      void actorId;
      void runtime.progression.current;
      expect(commandType).toBe("gain_score");
      return true;
    })
    .discoverable({
      discoverySchema: draftSchema,
      discover({ discovery }) {
        const selectedAmount = discovery.input.selectedAmount;

        if (typeof selectedAmount !== "number") {
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
            amount: selectedAmount,
          },
        };
      },
    })
    .validate(({ command }) => {
      expect(command.input.amount).toBeNumber();
      return { ok: true as const };
    })
    .execute(({ game, command }) => {
      game.increment();
      expect(command.input.amount).toBeNumber();
    })
    .build();

  expect(command.commandId).toBe("gain_score");
  expect(command.commandSchema).toBe(commandSchema);
  if (!("discoverySchema" in command)) {
    throw new Error("expected_discovery_schema");
  }
  expect(command.discoverySchema).toBe(draftSchema);
});

test("command builder hides invalid chained methods at each stage", () => {
  const defineCommand = createCommandFactory<{
    counter: number;
  }>();

  const commandSchema = t.object({
    amount: t.number(),
  });
  const discoverySchema = t.object({
    selectedAmount: t.optional(t.number()),
  });

  const baseBuilder = defineCommand({
    commandId: "increment",
    commandSchema,
  });

  // @ts-expect-error build should not exist before validate and execute are set
  void baseBuilder.build;

  const validatedBuilder = baseBuilder.validate(() => ({ ok: true as const }));

  // @ts-expect-error build should not exist before execute is set
  void validatedBuilder.build;

  const executedBuilder = defineCommand({
    commandId: "increment_without_validate",
    commandSchema,
  }).execute(({ game, command }) => {
    game.counter += command.input?.amount ?? 0;
  });

  // @ts-expect-error build should not exist before validate is set
  void executedBuilder.build;

  const discoverableBuilder = baseBuilder.discoverable({
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
  });

  // @ts-expect-error discovery should only be configurable once
  void discoverableBuilder.discoverable;

  expect(baseBuilder).toBeObject();
  expect(validatedBuilder).toBeObject();
  expect(executedBuilder).toBeObject();
  expect(discoverableBuilder).toBeObject();
});

test("internal command definitions still expose canonical state separately from facade state", () => {
  const gainScoreCommandSchema = t.object({
    amount: t.number(),
  });
  type GainScoreInput = typeof gainScoreCommandSchema.static;

  const definition: InternalCommandDefinition<
    { score: number },
    { increment(): void },
    RuntimeState,
    GainScoreInput
  > = {
    commandId: "gain_score",
    commandSchema: gainScoreCommandSchema,
    validate: ({ game, state, command }) => {
      void game.increment;
      void state.game.score;
      const amount: number | undefined = command.input?.amount;
      return {
        ok: typeof amount === "number",
        reason: "amount_required",
      };
    },
    execute: ({ game, state, command }) => {
      game.increment();
      void state.game.score;
      const amount: number | undefined = command.input?.amount;
      void amount;
    },
  };

  const context: InternalExecuteContext<
    { score: number },
    { increment(): void },
    RuntimeState,
    CommandFromSchema<GainScoreInput>
  > = {
    state: {
      game: {
        score: 1,
      },
      runtime: {
        progression: {
          current: null,
          rootId: null,
          segments: {},
        },
        rng: {
          seed: "seed",
          cursor: 0,
        },
        history: {
          entries: [],
        },
      },
    },
    game: {
      increment() {},
    },
    runtime: {
      progression: {
        current: null,
        rootId: null,
        segments: {},
      },
      rng: {
        seed: "seed",
        cursor: 0,
      },
      history: {
        entries: [],
      },
    },
    command: {
      type: "gain_score",
      actorId: "p1",
      input: {
        amount: 2,
      },
    },
    rng: {
      number() {
        return 0.5;
      },
      die() {
        return 1;
      },
      shuffle<T>(items: readonly T[]) {
        return [...items];
      },
    },
    setCurrentSegmentOwner() {},
    emitEvent() {},
  };

  definition.execute(context);
  expect(definition.commandId).toBe("gain_score");
});
