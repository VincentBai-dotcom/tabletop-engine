import { describe, expect, it } from "vitest";
import {
  defineEvents,
  defineGameState,
  GameDefinitionBuilder,
  t,
} from "../src/index.ts";
import { createTerminalStage } from "./helpers/stages.ts";

class CounterStateClass {
  count = 0;
}

function buildCounterState() {
  return defineGameState()
    .model({ count: t.number() })
    .stateClass(CounterStateClass)
    .build();
}

const counterEvents = defineEvents({
  incremented: t.object({ by: t.number() }),
});

describe("GameDefinitionBuilder.events", () => {
  it("stores the event registry on the built definition", () => {
    const def = new GameDefinitionBuilder("counter")
      .state(buildCounterState())
      .events(counterEvents)
      .players({ min: 1, max: 8 })
      .initialStage(createTerminalStage<CounterStateClass>())
      .build();

    expect(def.eventDefinitions).toBe(counterEvents);
  });

  it("defaults eventDefinitions to an empty object when .events() is not called", () => {
    const def = new GameDefinitionBuilder("counter")
      .state(buildCounterState())
      .players({ min: 1, max: 8 })
      .initialStage(createTerminalStage<CounterStateClass>())
      .build();

    expect(def.eventDefinitions).toEqual({});
  });
});
