import { expect, test } from "bun:test";
import type {
  CommandAvailabilityContext,
  CanonicalState,
  Command,
  CommandDiscoveryResult,
  DiscoveryContext,
  ExecutionResult,
  KernelEvent,
  ProgressionCompletionContext,
  ProgressionDefinition,
  ProgressionLifecycleHookContext,
  ProgressionResolveNextResult,
  ValidationOutcome,
} from "../src/index";

test("foundational runtime types compose", () => {
  const event: KernelEvent = {
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
      pending: {
        choices: [],
      },
    },
  };

  const command: Command = {
    type: "draw_card",
    actorId: "p1",
    payload: { count: 1 },
  };

  const result: ExecutionResult = {
    ok: true,
    state,
    events: [event],
    pendingChoices: [],
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
    state: {
      game: { score: 0 },
      runtime: {
        progression: {
          current: "turn",
        },
      },
    },
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

test("discovery types compose for command availability and next-input options", () => {
  const availabilityContext: CommandAvailabilityContext<
    { handCount: number },
    {
      progression: {
        current: string | null;
        rootId: string | null;
        segments: Record<string, never>;
      };
      rng: { seed: string; cursor: number };
      history: { entries: [] };
      pending: { choices: [] };
    }
  > = {
    state: {
      game: { handCount: 3 },
      runtime: {
        progression: { current: "turn", rootId: "turn", segments: {} },
        rng: { seed: "seed", cursor: 0 },
        history: { entries: [] },
        pending: { choices: [] },
      },
    },
    commandType: "play_card",
    actorId: "p1",
  };

  const discoveryContext: DiscoveryContext<
    { handCount: number },
    {
      progression: {
        current: string | null;
        rootId: string | null;
        segments: Record<string, never>;
      };
      rng: { seed: string; cursor: number };
      history: { entries: [] };
      pending: { choices: [] };
    }
  > = {
    ...availabilityContext,
    partialCommand: {
      type: "play_card",
      actorId: "p1",
      payload: {
        cardId: 12,
      },
    },
  };

  const discovery: CommandDiscoveryResult<{
    id: string;
    value: number;
  }> = {
    step: "select_target",
    options: [
      {
        id: "target-1",
        value: 101,
      },
    ],
    complete: false,
    nextPartialCommand: {
      type: "play_card",
      actorId: "p1",
      payload: {
        cardId: 12,
      },
    },
  };

  expect(availabilityContext.actorId).toBe("p1");
  expect(discoveryContext.partialCommand.payload).toEqual({ cardId: 12 });
  expect(discovery.step).toBe("select_target");
  expect(discovery.options[0]?.id).toBe("target-1");
});
