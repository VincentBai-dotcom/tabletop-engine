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
import { TransportClient } from "../src/client/client-core.ts";
import { TransportError } from "../src/index.ts";
import {
  FakeTransport,
  type FakeTransportOptions,
} from "./support/fake-transport.ts";

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
      .players({ min: 1, max: 8 })
      .initialStage(turn)
      .build(),
  );
}

const executor = buildExecutor();
type Executor = typeof executor;

const snapshot = {
  viewerId: "p1",
  view: {} as unknown as GameShapeOf<Executor>["view"],
  version: 1,
};

function makeClient(overrides: Partial<FakeTransportOptions<Executor>> = {}) {
  const transport = new FakeTransport<Executor>({
    discoverResult: {
      complete: true,
      input: { n: 1 },
    } as unknown as GameShapeOf<Executor>["discovery"]["result"],
    ...overrides,
  });
  const client = new TransportClient<Executor>(transport);
  return { client, transport };
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

  test("born connecting: no viewerId or view until the first snapshot", async () => {
    const { client, transport } = makeClient();

    expect(client.getStatus()).toBe("connecting");
    expect(client.getViewerId()).toBeNull();
    expect(client.getView()).toBeNull();
    expect(client.getStateVersion()).toBeNull();

    transport.emitSnapshot(snapshot);
    await client.ready();

    expect(client.getStatus()).toBe("ready");
    expect(client.getViewerId()).toBe("p1");
    expect(client.getView()).not.toBeNull();
    expect(client.getStateVersion()).toBe(1);
  });

  test("subscribe fires on the connecting → ready transition", () => {
    const { client, transport } = makeClient();
    let calls = 0;
    client.subscribe(() => {
      calls += 1;
    });

    transport.emitSnapshot(snapshot);

    expect(calls).toBe(1);
  });

  test("subscribe returns a working unsubscribe", () => {
    const { client, transport } = makeClient();
    let calls = 0;
    const unsubscribe = client.subscribe(() => {
      calls += 1;
    });
    unsubscribe();

    transport.emitSnapshot(snapshot);

    expect(calls).toBe(0);
  });

  test("ready() resolves immediately once already ready", async () => {
    const { client, transport } = makeClient();
    transport.emitSnapshot(snapshot);
    await client.ready();

    await expect(client.ready()).resolves.toBeUndefined();
  });

  test("a later snapshot bumps the version and notifies", () => {
    const { client, transport } = makeClient();
    let calls = 0;
    transport.emitSnapshot(snapshot);
    client.subscribe(() => {
      calls += 1;
    });

    transport.emitSnapshot({ ...snapshot, version: 2 });

    expect(client.getStateVersion()).toBe(2);
    expect(calls).toBe(1);
  });

  test("reconnecting then a snapshot returns to ready", () => {
    const { client, transport } = makeClient();
    transport.emitSnapshot(snapshot);

    transport.reconnecting();
    expect(client.getStatus()).toBe("reconnecting");

    transport.emitSnapshot({ ...snapshot, version: 2 });
    expect(client.getStatus()).toBe("ready");
  });

  test("execute before ready rejects TransportError(not_ready)", async () => {
    const { client } = makeClient();

    const error = await rejection(
      client.execute({ type: "score", input: { n: 1 } }),
    );

    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("not_ready");
  });

  test("discover before ready rejects TransportError(not_ready)", async () => {
    const { client } = makeClient();

    const error = await rejection(
      client.discover({ type: "score", step: "pick", input: {} }),
    );

    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("not_ready");
  });

  test("execute after ready delegates and resolves a game-rule rejection", async () => {
    const { client, transport } = makeClient({
      executeResult: { accepted: false, reason: "illegal_move" },
    });
    transport.emitSnapshot(snapshot);

    const result = await client.execute({ type: "score", input: { n: 1 } });

    expect(result).toEqual({ accepted: false, reason: "illegal_move" });
    expect(transport.executeCalls).toBe(1);
  });

  test("discover after ready delegates to the transport", async () => {
    const { client, transport } = makeClient();
    transport.emitSnapshot(snapshot);

    const result = await client.discover({
      type: "score",
      step: "pick",
      input: {},
    });

    expect(result).toMatchObject({ complete: true });
    expect(transport.discoverCalls).toBe(1);
  });

  test("getAvailableCommands rejects before ready, delegates after", async () => {
    const { client, transport } = makeClient({ availableCommands: ["score"] });

    const error = await rejection(client.getAvailableCommands());
    expect(error).toBeInstanceOf(TransportError);

    transport.emitSnapshot(snapshot);
    await expect(client.getAvailableCommands()).resolves.toEqual(["score"]);
    expect(transport.listCalls).toBe(1);
  });

  test("dispose() closes the transport, notifies, and rejects a pending ready()", async () => {
    const { client, transport } = makeClient();
    const pending = client.ready();
    let notified = 0;
    client.subscribe(() => {
      notified += 1;
    });

    client.dispose();

    expect(client.getStatus()).toBe("closed");
    expect(transport.closed).toBe(true);
    expect(notified).toBe(1);
    const error = await rejection(pending);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("closed");
  });

  test("transport-signalled close rejects a pending ready()", async () => {
    const { client, transport } = makeClient();
    const pending = client.ready();

    transport.serverClosed();

    expect(client.getStatus()).toBe("closed");
    const error = await rejection(pending);
    expect((error as TransportError).reason).toBe("closed");
  });

  test("ready() rejects if the transport errors before becoming ready", async () => {
    const { client, transport } = makeClient();
    const pending = client.ready();

    transport.fail();

    expect(client.getStatus()).toBe("error");
    const error = await rejection(pending);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("connection_lost");
  });

  test("ready() after an error reports that failure's reason", async () => {
    const { client, transport } = makeClient();
    transport.fail("not_ready");

    const error = await rejection(client.ready());
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("not_ready");
  });

  test("onEvent delivers events until unsubscribed", () => {
    const { client, transport } = makeClient();
    transport.emitSnapshot(snapshot);

    const seen: GameShapeOf<Executor>["event"][] = [];
    const off = client.onEvent((event) => {
      seen.push(event);
    });

    transport.emitEvent({
      category: "domain",
      type: "scored",
      payload: { points: 3 },
    });
    expect(seen).toHaveLength(1);

    off();
    transport.emitEvent({
      category: "domain",
      type: "scored",
      payload: { points: 1 },
    });
    expect(seen).toHaveLength(1);
  });
});
