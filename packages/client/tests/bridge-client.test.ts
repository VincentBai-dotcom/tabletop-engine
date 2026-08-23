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
import {
  BridgeTransport,
  bridgeMessages,
  type BridgeEndpoint,
} from "../src/bridge/bridge-transport.ts";
import { TransportError } from "../src/index.ts";

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
    .execute(({ game, command }) => {
      game.count += command.input.n;
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

interface PostedMessage {
  type: string;
  requestId?: string;
  payload?: unknown;
}

class FakeBridge implements BridgeEndpoint {
  readonly posted: PostedMessage[] = [];
  #listener: ((message: unknown) => void) | null = null;

  post(message: unknown): void {
    this.posted.push(message as PostedMessage);
  }

  subscribe(listener: (message: unknown) => void): () => void {
    this.#listener = listener;
    return () => {
      this.#listener = null;
    };
  }

  get subscribed(): boolean {
    return this.#listener !== null;
  }

  send(message: unknown): void {
    this.#listener?.(message);
  }

  lastRequest(type: string): PostedMessage | undefined {
    return [...this.posted].reverse().find((message) => message.type === type);
  }
}

const snapshotPayload = {
  viewerId: "p1",
  view: {} as unknown as GameShapeOf<Executor>["view"],
  version: 1,
};

function makeClient() {
  const bridge = new FakeBridge();
  const client = new TransportClient(
    new BridgeTransport<Executor>({ endpoint: bridge }),
  );
  return { client, bridge };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected the promise to reject");
    },
    (error: unknown) => error,
  );
}

describe("bridge client", () => {
  test("executor is constructed", () => {
    expect(executor.createInitialState).toBeTypeOf("function");
  });

  test("posts a ready handshake and reaches ready on the first snapshot", async () => {
    const { client, bridge } = makeClient();

    expect(bridge.posted).toContainEqual({ type: bridgeMessages.ready });
    expect(client.getStatus()).toBe("connecting");

    bridge.send({ type: bridgeMessages.snapshot, payload: snapshotPayload });
    await client.ready();

    expect(client.getStatus()).toBe("ready");
    expect(client.getViewerId()).toBe("p1");
    expect(client.getStateVersion()).toBe(1);
  });

  test("execute posts a correlated request and resolves on the matching result", async () => {
    const { client, bridge } = makeClient();
    bridge.send({ type: bridgeMessages.snapshot, payload: snapshotPayload });
    await client.ready();

    const pending = client.execute({ type: "score", input: { n: 2 } });
    const request = bridge.lastRequest(bridgeMessages.execute);
    expect(request?.payload).toEqual({ type: "score", input: { n: 2 } });
    expect(request?.requestId).toBeTypeOf("string");

    bridge.send({
      type: bridgeMessages.executionResult,
      requestId: request?.requestId,
      payload: { accepted: false, reason: "illegal_move" },
    });

    expect(await pending).toEqual({ accepted: false, reason: "illegal_move" });
  });

  test("discover and listAvailableCommands resolve on their results", async () => {
    const { client, bridge } = makeClient();
    bridge.send({ type: bridgeMessages.snapshot, payload: snapshotPayload });
    await client.ready();

    const discovering = client.discover({
      type: "score",
      step: "pick",
      input: {},
    });
    const discoverRequest = bridge.lastRequest(bridgeMessages.discover);
    bridge.send({
      type: bridgeMessages.discoveryResult,
      requestId: discoverRequest?.requestId,
      payload: { complete: true, input: { n: 1 } },
    });
    expect(await discovering).toMatchObject({ complete: true });

    const listing = client.getAvailableCommands();
    const listRequest = bridge.lastRequest(bridgeMessages.listCommands);
    bridge.send({
      type: bridgeMessages.availableCommands,
      requestId: listRequest?.requestId,
      payload: ["score"],
    });
    expect(await listing).toEqual(["score"]);
  });

  test("an error response rejects the correlated request with its reason", async () => {
    const { client, bridge } = makeClient();
    bridge.send({ type: bridgeMessages.snapshot, payload: snapshotPayload });
    await client.ready();

    const pending = client.execute({ type: "score", input: { n: 1 } });
    const request = bridge.lastRequest(bridgeMessages.execute);
    bridge.send({
      type: bridgeMessages.error,
      requestId: request?.requestId,
      reason: "server_error",
    });

    const error = await rejection(pending);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("server_error");
  });

  test("execute rejects when the result envelope is malformed", async () => {
    const { client, bridge } = makeClient();
    bridge.send({ type: bridgeMessages.snapshot, payload: snapshotPayload });
    await client.ready();

    const pending = client.execute({ type: "score", input: { n: 1 } });
    const request = bridge.lastRequest(bridgeMessages.execute);
    bridge.send({
      type: bridgeMessages.executionResult,
      requestId: request?.requestId,
      payload: { accepted: "nope" },
    });

    const error = await rejection(pending);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).reason).toBe("server_error");
  });

  test("a malformed snapshot push moves the client to error", () => {
    const { client, bridge } = makeClient();

    bridge.send({ type: bridgeMessages.snapshot, payload: { version: 1 } });

    expect(client.getStatus()).toBe("error");
  });

  test("pushed events reach onEvent", async () => {
    const { client, bridge } = makeClient();
    bridge.send({ type: bridgeMessages.snapshot, payload: snapshotPayload });
    await client.ready();

    const seen: GameShapeOf<Executor>["event"][] = [];
    client.onEvent((event) => seen.push(event));

    bridge.send({
      type: bridgeMessages.event,
      payload: { category: "domain", type: "scored", payload: { points: 4 } },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.type).toBe("scored");
  });

  test("a connection-level error moves the client to error", () => {
    const { client, bridge } = makeClient();

    bridge.send({ type: bridgeMessages.error, reason: "connection_lost" });

    expect(client.getStatus()).toBe("error");
  });

  test("game_ended closes the client", async () => {
    const { client, bridge } = makeClient();
    bridge.send({ type: bridgeMessages.snapshot, payload: snapshotPayload });
    await client.ready();

    bridge.send({ type: bridgeMessages.ended });

    expect(client.getStatus()).toBe("closed");
  });

  test("dispose unsubscribes and rejects pending requests", async () => {
    const { client, bridge } = makeClient();
    bridge.send({ type: bridgeMessages.snapshot, payload: snapshotPayload });
    await client.ready();

    const pending = client.execute({ type: "score", input: { n: 1 } });
    client.dispose();

    expect(bridge.subscribed).toBe(false);
    const error = await rejection(pending);
    expect((error as TransportError).reason).toBe("closed");
  });
});
