import { describe, expect, it } from "vitest";
import {
  createCommandFactory,
  createGameExecutor,
  defineEvents,
  defineGameState,
  GameDefinitionBuilder,
  t,
} from "../src/index.ts";
import { createSelfLoopingTurnStage } from "./helpers/stages.ts";

class CounterStateClass {
  count = 0;
}

function buildCounterExecutor(options?: { emitUndeclared?: boolean }) {
  const CounterState = defineGameState()
    .model({ count: t.number() })
    .stateClass(CounterStateClass)
    .build();

  const events = defineEvents({
    incremented: t.object({ by: t.number() }),
  });

  const defineCommand = createCommandFactory<
    CounterStateClass,
    typeof events
  >();
  const increment = defineCommand({
    commandId: "increment",
    commandSchema: t.object({ amount: t.number() }),
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game, command, emitEvent }) => {
      game.count += command.input.amount;
      if (options?.emitUndeclared) {
        // Simulate untrusted bundled code bypassing the compile-time registry:
        // the runtime validation must still reject an undeclared event type.
        (
          emitEvent as (event: {
            type: string;
            payload: Record<string, unknown>;
          }) => void
        )({ type: "nope", payload: {} });
      } else {
        emitEvent({
          type: "incremented",
          payload: { by: command.input.amount },
        });
      }
    })
    .build();

  const turnStage = createSelfLoopingTurnStage<CounterStateClass>([increment], {
    activePlayerId: "p1",
  });

  const game = new GameDefinitionBuilder("counter")
    .state(CounterState)
    .events(events)
    .initialStage(turnStage)
    .build();

  return createGameExecutor(game);
}

describe("emitEvent runtime validation", () => {
  it("stamps category:domain and keeps the payload for a declared event", () => {
    const executor = buildCounterExecutor();
    const state = executor.createInitialState("seed");
    const result = executor.executeCommand(state, {
      type: "increment",
      actorId: "p1",
      input: { amount: 2 },
    });
    expect(result.ok).toBe(true);
    expect(result.events).toContainEqual({
      category: "domain",
      type: "incremented",
      payload: { by: 2 },
    });
  });

  it("throws when emitting an undeclared event type", () => {
    const executor = buildCounterExecutor({ emitUndeclared: true });
    const state = executor.createInitialState("seed");
    expect(() =>
      executor.executeCommand(state, {
        type: "increment",
        actorId: "p1",
        input: { amount: 1 },
      }),
    ).toThrow(/unknown_event_type/);
  });
});
