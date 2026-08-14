import { describe, expect, test } from "vitest";
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
import { TransportError } from "../src/index.ts";
import {
  ReferenceClient,
  type ReferenceClientOptions,
} from "./support/reference-client.ts";

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
      throw new Error("not used by this test");
    })
    .build();

  return createGameExecutor(
    new GameDefinitionBuilder("demo")
      .state(state)
      .events(events)
      .initialStage(turn)
      .build(),
  );
}

const executor = buildExecutor();
type Executor = typeof executor;

function makeClient(
  overrides: Partial<ReferenceClientOptions<Executor>> = {},
): ReferenceClient<Executor> {
  return new ReferenceClient<Executor>({
    viewerId: "p1",
    view: {} as unknown as GameShapeOf<Executor>["view"],
    discoverResult: {
      complete: true,
      input: { n: 1 },
    } as unknown as GameShapeOf<Executor>["discovery"]["result"],
    ...overrides,
  });
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected the promise to reject");
    },
    (error: unknown) => error,
  );
}

describe("client lifecycle / identity / error contract", () => {
  test("executor is constructed", () => {
    expect(executor.createInitialState).toBeTypeOf("function");
  });

  test("born connecting: no viewerId or view until ready", async () => {
    const client = makeClient();

    expect(client.getStatus()).toBe("connecting");
    expect(client.getViewerId()).toBeNull();
    expect(client.getView()).toBeNull();
    expect(client.getStateVersion()).toBeNull();

    await client.ready();

    expect(client.getStatus()).toBe("ready");
    expect(client.getViewerId()).toBe("p1");
    expect(client.getView()).not.toBeNull();
    expect(client.getStateVersion()).toBe(1);
  });

  test("subscribe fires once on the connecting → ready transition", async () => {
    const client = makeClient();
    let calls = 0;
    client.subscribe(() => {
      calls += 1;
    });

    await client.ready();

    expect(calls).toBe(1);
  });

  test("subscribe returns a working unsubscribe", async () => {
    const client = makeClient();
    let calls = 0;
    const unsubscribe = client.subscribe(() => {
      calls += 1;
    });
    unsubscribe();

    await client.ready();

    expect(calls).toBe(0);
  });

  test("ready() resolves immediately once already ready", async () => {
    const client = makeClient();
    await client.ready();

    await expect(client.ready()).resolves.toBeUndefined();
  });

  test("execute before ready rejects TransportError(not_ready)", async () => {
    const client = makeClient();

    const error = await rejection(
      client.execute({ type: "score", input: { n: 1 } }),
    );

    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("not_ready");
  });

  test("discover before ready rejects TransportError(not_ready)", async () => {
    const client = makeClient();

    const error = await rejection(
      client.discover({ type: "score", step: "pick", input: {} }),
    );

    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("not_ready");
  });

  test("execute after ready resolves a game-rule rejection in-band", async () => {
    const client = makeClient({
      executeResult: { accepted: false, reason: "illegal_move" },
    });
    await client.ready();

    const result = await client.execute({ type: "score", input: { n: 1 } });

    expect(result).toEqual({ accepted: false, reason: "illegal_move" });
  });

  test("discover after ready resolves the discovery result", async () => {
    const client = makeClient();
    await client.ready();

    const result = await client.discover({
      type: "score",
      step: "pick",
      input: {},
    });

    expect(result).toMatchObject({ complete: true });
  });

  test("dispose() closes, notifies subscribers, and rejects a pending ready()", async () => {
    const client = makeClient();
    const pending = client.ready();
    let notified = 0;
    client.subscribe(() => {
      notified += 1;
    });

    client.dispose();

    expect(client.getStatus()).toBe("closed");
    expect(notified).toBe(1);
    const error = await rejection(pending);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("closed");
  });

  test("ready() rejects if the client errors before becoming ready", async () => {
    const client = makeClient();
    const pending = client.ready();

    client.fail();

    expect(client.getStatus()).toBe("error");
    const error = await rejection(pending);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("connection_lost");
  });

  test("ready() after an error reports that failure's reason", async () => {
    const client = makeClient();
    client.fail("not_ready");

    const error = await rejection(client.ready());
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("not_ready");
  });

  test("onEvent delivers events until unsubscribed", async () => {
    const client = makeClient();
    await client.ready();

    const seen: GameShapeOf<Executor>["event"][] = [];
    const off = client.onEvent((event) => {
      seen.push(event);
    });

    client.emit({ category: "domain", type: "scored", payload: { points: 3 } });
    expect(seen).toHaveLength(1);

    off();
    client.emit({ category: "domain", type: "scored", payload: { points: 1 } });
    expect(seen).toHaveLength(1);
  });
});
