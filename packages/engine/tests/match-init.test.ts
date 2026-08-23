import { expect, test } from "vitest";
import {
  assertSchemaValue,
  createCommandFactory,
  createGameExecutor,
  createSnapshot,
  createStageFactory,
  defineGameState,
  GameDefinitionBuilder,
  restoreSnapshot,
  t,
} from "../src/index";
import type { SingleActivePlayerStageDefinition } from "../src/types/progression";

// A minimal root state that records what setup saw of the roster, so a test can
// prove the authoritative `players` reached both setup and the stage machine.
class RootStateClass {
  firstSeat = "";
  seatCount = 0;
}

const RootState = defineGameState()
  .model({ firstSeat: t.string(), seatCount: t.number() })
  .stateClass(RootStateClass)
  .build();

const defineCommand = createCommandFactory<RootStateClass>();
const noop = defineCommand({ commandId: "noop", commandSchema: t.object({}) })
  .validate(() => ({ ok: true as const }))
  .execute(() => {})
  .build();

// A no-setup game whose active player is the first seat of the roster and whose
// setup copies the roster into game state.
function createRosterGame() {
  const defineStage = createStageFactory<RootStateClass>();
  const turn: SingleActivePlayerStageDefinition<RootStateClass> = defineStage(
    "turn",
  )
    .singleActivePlayer()
    .activePlayer(({ runtime }) => runtime.players[0]!)
    .commands([noop])
    .nextStages(() => ({ turn }))
    .transition(({ nextStages }) => nextStages.turn)
    .build();

  return new GameDefinitionBuilder("roster-game")
    .state(RootState)
    .initialStage(turn)
    .setup(({ game, players }) => {
      game.firstSeat = players[0]!;
      game.seatCount = players.length;
    })
    .build();
}

// A with-setup game, to exercise the conditional init type and setup validation
// alongside the authoritative roster.
function createSetupRosterGame() {
  const defineStage = createStageFactory<RootStateClass>();
  const bootstrap = defineStage("bootstrap").automatic().build();

  return new GameDefinitionBuilder("setup-roster-game")
    .state(RootState)
    .initialStage(bootstrap)
    .setupInput(t.object({ label: t.string() }))
    .setup(({ game, players, input }) => {
      game.firstSeat = `${players[0]!}:${input.label}`;
      game.seatCount = players.length;
    })
    .build();
}

test("stores the roster in runtime.players and exposes it to setup and stages", () => {
  const executor = createGameExecutor(createRosterGame());

  const state = executor.createInitialState({
    seed: "seed",
    players: ["a", "b", "c"],
  });

  expect(state.runtime.players).toEqual(["a", "b", "c"]);
  // setup read the roster.
  expect(state.game.firstSeat).toBe("a");
  expect(state.game.seatCount).toBe(3);
  // the stage machine's activePlayer read runtime.players[0].
  expect(state.runtime.progression.currentStage).toMatchObject({
    kind: "activePlayer",
    activePlayerId: "a",
  });
});

test("runtime.players is a copy, not an alias of the caller's array", () => {
  const executor = createGameExecutor(createRosterGame());
  const roster = ["a", "b"];

  const state = executor.createInitialState({ seed: "seed", players: roster });
  roster.push("c");

  expect(state.runtime.players).toEqual(["a", "b"]);
});

test("rejects a missing or invalid seed", () => {
  const executor = createGameExecutor(createRosterGame());

  expect(() =>
    executor.createInitialState({ players: ["a"] } as never),
  ).toThrow("rng_seed_required");
});

test("rejects a missing, empty, or non-string roster", () => {
  const executor = createGameExecutor(createRosterGame());

  expect(() => executor.createInitialState({ seed: "seed" } as never)).toThrow(
    "players_required",
  );
  expect(() =>
    executor.createInitialState({ seed: "seed", players: [] }),
  ).toThrow("players_required");
  expect(() =>
    executor.createInitialState({ seed: "seed", players: [1] as never }),
  ).toThrow("players_required");
});

test("rejects a roster with duplicate seats", () => {
  const executor = createGameExecutor(createRosterGame());

  expect(() =>
    executor.createInitialState({ seed: "seed", players: ["a", "a"] }),
  ).toThrow("players_not_unique");
});

test("a with-setup game receives both the roster and the validated setup", () => {
  const executor = createGameExecutor(createSetupRosterGame());

  const state = executor.createInitialState({
    seed: "seed",
    players: ["a", "b"],
    setup: { label: "start" },
  });

  expect(state.runtime.players).toEqual(["a", "b"]);
  expect(state.game.firstSeat).toBe("a:start");
  expect(state.game.seatCount).toBe(2);
});

test("a with-setup game rejects a missing or invalid setup", () => {
  const executor = createGameExecutor(createSetupRosterGame());

  expect(() =>
    executor.createInitialState({ seed: "seed", players: ["a"] } as never),
  ).toThrow("setup_input_required");
  expect(() =>
    executor.createInitialState({
      seed: "seed",
      players: ["a"],
      setup: { label: 1 as unknown as string },
    }),
  ).toThrow("invalid_schema_value");
});

test("the compiled runtime schema validates players", () => {
  const game = createRosterGame();
  const executor = createGameExecutor(game);
  const state = executor.createInitialState({ seed: "seed", players: ["a"] });

  expect(() =>
    assertSchemaValue(game.runtimeStateSchema, state.runtime),
  ).not.toThrow();

  const withoutPlayers = structuredClone(state.runtime) as unknown as Record<
    string,
    unknown
  >;
  delete withoutPlayers.players;
  expect(() =>
    assertSchemaValue(game.runtimeStateSchema, withoutPlayers),
  ).toThrow("invalid_schema_value");
});

test("a snapshot round-trips the roster", () => {
  const executor = createGameExecutor(createRosterGame());
  const state = executor.createInitialState({
    seed: "seed",
    players: ["a", "b"],
  });

  const restored = restoreSnapshot(createSnapshot(state));

  expect(restored.runtime.players).toEqual(["a", "b"]);
});

test("the init type gates setup at compile time", () => {
  const setupExecutor = createGameExecutor(createSetupRosterGame());
  const rosterExecutor = createGameExecutor(createRosterGame());

  // Never invoked — these assert the compile-time gate, not runtime behavior. Each
  // createInitialState call is one line so the directive lands on the exact error.
  const missingSetup = () =>
    // @ts-expect-error a with-setup game requires `setup` in the init object.
    setupExecutor.createInitialState({ seed: "seed", players: ["a"] });

  const excessSetup = () =>
    // @ts-expect-error a no-setup game does not accept a `setup` field.
    rosterExecutor.createInitialState({
      seed: "seed",
      players: ["a"],
      setup: {},
    });

  void missingSetup;
  void excessSetup;
});
