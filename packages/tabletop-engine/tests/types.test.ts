import { expect, test } from "bun:test";
import type {
  CommandAvailabilityContext,
  CommandInput,
  CommandDiscoveryResult,
  CanonicalState,
  DiscoveryInput,
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
  CommandInputFromSchema,
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

  const command: CommandInput = {
    type: "draw_card",
    actorId: "p1",
    payload: { count: 1 },
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
    CommandInput<{ amount: number }>
  > = {
    game: { score: 0 },
    runtime: {
      progression: {
        current: "turn",
      },
    },
    commandInput: {
      type: "gain_score",
      payload: { amount: 1 },
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
    CommandInput<{ amount: number }>
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
    CommandInput<{ amount: number }>
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
  type PlayCardDraft = {
    step: string;
    cardId?: number;
    targets?: number[];
  };

  type PlayCardPayload = {
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

  const discoveryInput: DiscoveryInput<PlayCardDraft> = {
    type: "play_card",
    actorId: "p1",
    draft: {
      step: "select_target",
      cardId: 12,
    },
  };

  const discoveryContext: DiscoveryContext<
    { handCount: number },
    PlayCardDraft
  > = {
    ...availabilityContext,
    discoveryInput,
  };

  const discovery: CommandDiscoveryResult<PlayCardDraft, PlayCardPayload> = {
    complete: false,
    step: "select_target",
    options: [
      {
        id: "target-1",
        nextDraft: {
          step: "complete",
          cardId: 12,
          targets: [101],
        },
      },
    ],
  };

  const completion: CommandDiscoveryResult<PlayCardDraft, PlayCardPayload> = {
    complete: true,
    payload: {
      cardId: 12,
      targets: [101],
    },
  };

  expect(availabilityContext.actorId).toBe("p1");
  expect(discoveryContext.discoveryInput.draft).toEqual({
    step: "select_target",
    cardId: 12,
  });
  expect(discovery.step).toBe("select_target");
  expect(discovery.options[0]?.id).toBe("target-1");
  if (!discovery.complete) {
    expect(discovery.options[0]?.nextDraft).toEqual({
      step: "complete",
      cardId: 12,
      targets: [101],
    });
  }
  if (completion.complete) {
    expect(completion.payload).toEqual({
      cardId: 12,
      targets: [101],
    });
  }
});

test("consumer command definitions only expose game state and command input generics", () => {
  const defineCommand = createCommandFactory<{
    increment(): void;
  }>();
  const gainScorePayload = t.object({
    amount: t.number(),
  });

  const definition = defineCommand({
    commandId: "gain_score",
    payloadSchema: gainScorePayload,
    discoveryDraftSchema: t.object({
      amount: t.optional(t.number()),
    }),
    discover: ({ discoveryInput }) => {
      if (typeof discoveryInput.draft?.amount !== "number") {
        return {
          complete: false as const,
          step: "select_amount",
          options: [
            {
              id: "amount-1",
              nextDraft: { amount: 1 },
            },
          ],
        };
      }

      return {
        complete: true as const,
        payload: {
          amount: discoveryInput.draft.amount,
        },
      };
    },
    validate: ({ commandInput }) => {
      const amount: number | undefined = commandInput.payload?.amount;

      return {
        ok: typeof amount === "number",
        reason: "amount_required",
      };
    },
    execute: ({ game, commandInput }) => {
      game.increment();
      const amount: number | undefined = commandInput.payload?.amount;
      void amount;
    },
  });

  expect(definition.commandId).toBe("gain_score");
});

test("command factory contextually types command lifecycle methods", () => {
  const defineCommand = createCommandFactory<{
    score: number;
    increment(): void;
  }>();

  const payloadSchema = t.object({
    amount: t.number(),
  });
  const draftSchema = t.object({
    selectedAmount: t.optional(t.number()),
  });

  const command = defineCommand({
    commandId: "gain_score",
    payloadSchema,
    discoveryDraftSchema: draftSchema,
    isAvailable({ game, actorId, runtime, commandType }) {
      expect(typeof game.score).toBe("number");
      void game.increment;
      void actorId;
      void runtime.progression.current;
      expect(commandType).toBe("gain_score");
      return true;
    },
    discover({ discoveryInput }) {
      const selectedAmount = discoveryInput.draft?.selectedAmount;

      if (typeof selectedAmount !== "number") {
        return {
          complete: false as const,
          step: "select_amount",
          options: [
            {
              id: "one",
              nextDraft: {
                selectedAmount: 1,
              },
            },
          ],
        };
      }

      return {
        complete: true as const,
        payload: {
          amount: selectedAmount,
        },
      };
    },
    validate({ commandInput }) {
      expect(commandInput.payload?.amount).toBeNumber();
      return { ok: true as const };
    },
    execute({ game, commandInput }) {
      game.increment();
      expect(commandInput.payload?.amount).toBeNumber();
    },
  });

  expect(command.commandId).toBe("gain_score");
  expect(command.payloadSchema).toBe(payloadSchema);
  expect(command.discoveryDraftSchema).toBe(draftSchema);
});

test("internal command definitions still expose canonical state separately from facade state", () => {
  const gainScorePayload = t.object({
    amount: t.number(),
  });
  type GainScorePayload = typeof gainScorePayload.static;

  const definition: InternalCommandDefinition<
    { score: number },
    { increment(): void },
    RuntimeState,
    GainScorePayload
  > = {
    commandId: "gain_score",
    payloadSchema: gainScorePayload,
    validate: ({ game, state, commandInput }) => {
      void game.increment;
      void state.game.score;
      const amount: number | undefined = commandInput.payload?.amount;
      return {
        ok: typeof amount === "number",
        reason: "amount_required",
      };
    },
    execute: ({ game, state, commandInput }) => {
      game.increment();
      void state.game.score;
      const amount: number | undefined = commandInput.payload?.amount;
      void amount;
    },
  };

  const context: InternalExecuteContext<
    { score: number },
    { increment(): void },
    RuntimeState,
    CommandInputFromSchema<GainScorePayload>
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
    commandInput: {
      type: "gain_score",
      payload: {
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
