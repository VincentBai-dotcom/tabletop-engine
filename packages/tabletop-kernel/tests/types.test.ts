import { expect, test } from "bun:test";
import type {
  CanonicalState,
  Command,
  ExecutionResult,
  KernelEvent,
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
