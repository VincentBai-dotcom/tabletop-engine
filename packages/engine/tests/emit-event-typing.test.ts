import { expect, test } from "vitest";
import {
  createCommandFactory,
  createStageFactory,
  defineEvents,
  t,
} from "../src/index.ts";

// This suite is a compile-time contract: it passes at runtime trivially, but
// `tsc --noEmit` fails if the `@ts-expect-error` lines stop erroring — i.e. if
// the event registry ever stops narrowing `emitEvent`.

const events = defineEvents({
  scored: t.object({ points: t.number() }),
});

class TypingState {
  readonly _ = 0;
}

test("command emitEvent is typed to the declared event registry", () => {
  expect(events.scored).toBeDefined();
  const define = createCommandFactory<TypingState, typeof events>();

  define({ commandId: "c", commandSchema: t.object({}) })
    .validate(() => ({ ok: true as const }))
    .execute((ctx) => {
      ctx.emitEvent({ type: "scored", payload: { points: 1 } });
      // @ts-expect-error unknown event type
      ctx.emitEvent({ type: "nope", payload: {} });
      // @ts-expect-error wrong payload type
      ctx.emitEvent({ type: "scored", payload: { points: "x" } });
    })
    .build();
});

test("automatic stage run emitEvent is typed to the declared event registry", () => {
  const defineStage = createStageFactory<TypingState, typeof events>();

  defineStage("s")
    .automatic()
    .run((ctx) => {
      ctx.emitEvent({ type: "scored", payload: { points: 1 } });
      // @ts-expect-error unknown event type
      ctx.emitEvent({ type: "nope", payload: {} });
      // @ts-expect-error wrong payload type
      ctx.emitEvent({ type: "scored", payload: { points: "x" } });
    });
});
