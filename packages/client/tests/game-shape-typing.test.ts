import { expect, test } from "vitest";
import {
  createCommandFactory,
  createGameExecutor,
  createStageFactory,
  defineEvents,
  defineGameState,
  GameDefinitionBuilder,
  t,
} from "@tableverse-kit/engine";
import type { GameShapeOf } from "../src/client/game-shape.ts";

// Compile-time contract: this suite passes trivially at runtime, but the
// client typecheck (`tsc --noEmit`) fails if `GameShapeOf` stops deriving the
// correlated command / discovery / event shapes from the executor type.

class DemoState {
  count = 0;
}

const events = defineEvents({ scored: t.object({ points: t.number() }) });

function buildExecutor() {
  const state = defineGameState()
    .model({ count: t.number() })
    .stateClass(DemoState)
    .build();

  const define = createCommandFactory<DemoState, typeof events>();
  const score = define({
    commandId: "score",
    commandSchema: t.object({ n: t.number() }),
  })
    .discoverable((step) => [
      step("pick")
        .initial()
        .input(t.object({}))
        .output(t.object({ n: t.number() }))
        .resolve(() => ({ complete: true as const, input: { n: 1 } }))
        .build(),
    ])
    .validate(() => ({ ok: true as const }))
    .execute(({ game, command, emitEvent }) => {
      game.count += command.input.n;
      emitEvent({ type: "scored", payload: { points: command.input.n } });
    })
    .build();

  const defineStage = createStageFactory<DemoState, typeof events>();
  const turn = defineStage("turn")
    .singleActivePlayer()
    .activePlayer(() => "p1")
    .commands([score])
    .transition(() => {
      throw new Error("not used by this type test");
    })
    .build();

  return createGameExecutor(
    new GameDefinitionBuilder("demo")
      .state(state)
      .events(events)
      .players({ min: 1, max: 8 })
      .initialStage(turn)
      .build(),
  );
}

const executor = buildExecutor();
type Shape = GameShapeOf<typeof executor>;

test("executor is constructed", () => {
  expect(executor.createInitialState).toBeTypeOf("function");
});

test("command is a correlated discriminated union", () => {
  type Cmd = Shape["command"];

  const ok: Cmd = { type: "score", input: { n: 1 } };
  expect(ok.type).toBe("score");

  // discriminant narrows the input
  const narrow = (cmd: Cmd): number => (cmd.type === "score" ? cmd.input.n : 0);
  expect(narrow(ok)).toBe(1);

  // @ts-expect-error unknown command id
  const wrongId: Cmd = { type: "nope", input: {} };
  // @ts-expect-error wrong input type
  const wrongInput: Cmd = { type: "score", input: { n: "x" } };
  void wrongId;
  void wrongInput;
});

test("discovery payload is correlated to command id and step", () => {
  type Payload = Shape["discovery"]["payload"];

  const ok: Payload = { type: "score", step: "pick", input: {} };
  expect(ok.step).toBe("pick");

  // @ts-expect-error unknown step id
  const wrongStep: Payload = { type: "score", step: "nope", input: {} };
  void wrongStep;
});

test("event is the domain union plus engine runtime events", () => {
  type Ev = Shape["event"];

  const domain: Ev = {
    category: "domain",
    type: "scored",
    payload: { points: 1 },
  };
  expect(domain.type).toBe("scored");

  // runtime events are part of the union
  const runtime: Ev = {
    category: "runtime",
    type: "stage_entered",
    payload: {
      stageId: "turn",
      kind: "activePlayer",
      activePlayerId: "p1",
      activePlayerIds: null,
    },
  };
  expect(runtime.category).toBe("runtime");

  // prettier-ignore
  // @ts-expect-error wrong payload for a known domain event
  const wrongPayload: Ev = { category: "domain", type: "scored", payload: { points: "x" } };
  void wrongPayload;
});
