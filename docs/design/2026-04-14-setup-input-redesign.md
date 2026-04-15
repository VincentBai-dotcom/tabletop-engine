# Setup Input Redesign

## Purpose

This document redesigns game setup so session-specific input is owned by the
engine instead of being captured by closures around `GameDefinitionBuilder`.

The immediate motivation is:

- `packages/cli` currently has to guess game factory inputs
- example games like Splendor hide setup input outside the engine
- `rngSeed` is currently treated like build-time game-definition config even
  though it belongs to one created game session

The target model is:

- game definitions may declare a setup input schema
- `setup(...)` receives validated setup input from the engine
- `createInitialState(...)` becomes the session-initialization boundary
- `rngSeed` moves to `createInitialState(...)`

## Current Problems

### Setup Input Is Captured Outside The Engine

Current Splendor authoring in [game.ts](/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/src/game.ts#L10):

```ts
export function createSplendorGame(options: CreateSplendorGameOptions) {
  const { playerIds, seed } = options;

  return new GameDefinitionBuilder("splendor")
    .rootState(SplendorRootState)
    .rngSeed(seed)
    .setup(({ game, rng }) => {
      setupSplendorGame(game, rng, playerIds);
    })
    .initialStage(initialStage)
    .build();
}
```

Problems:

- the engine does not know the game's setup input shape
- `setup(...)` cannot declare or validate setup input
- CLI tooling cannot inspect setup input requirements
- game factories must capture setup data in closures

### `rngSeed` Is In The Wrong Layer

Current builder API in
[game-definition.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/game-definition.ts#L132):

```ts
  rngSeed(rngSeed: string | number | undefined): this {
    this.config.rngSeed = rngSeed;
    return this;
  }
```

Current executor API in
[game-executor.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/runtime/game-executor.ts#L290):

```ts
    createInitialState(options) {
      ...
      game.setup?.({
        ...
        playerIds: options?.playerIds ?? [],
      });
```

Problems:

- `rngSeed` belongs to one session, not the reusable game definition
- `createInitialState(...)` is the true session-creation boundary but does not
  own full setup input
- `playerIds` is special-cased as engine input instead of game setup input

## Design

### 1. Add `setupInput(...)` To `GameDefinitionBuilder`

Games may declare setup input using `t.object(...)` only.

Example:

```ts
new GameDefinitionBuilder("splendor")
  .rootState(SplendorRootState)
  .setupInput(
    t.object({
      playerIds: t.array(t.string()),
    }),
  )
  .setup(({ game, rng, input }) => {
    setupSplendorGame(game, rng, input.playerIds);
  })
  .initialStage(initialStage)
  .build();
```

Rules:

- `setupInput(...)` only accepts `t.object(...)`
- primitive, array, and non-object setup schemas are rejected
- the static setup-input type comes from the declared schema

Why object-only:

- setup input is named session configuration
- it is easier to validate, document, and prompt for in CLI tooling
- it avoids positional or ambiguous setup semantics

### 2. Move `rngSeed` To `createInitialState(...)`

`rngSeed` should be required at session creation time.

Target executor API:

- no setup input declared:

```ts
executor.createInitialState(rngSeed);
```

- setup input declared:

```ts
executor.createInitialState(
  {
    playerIds,
  },
  rngSeed,
);
```

This avoids reserved-name collisions inside the developer-defined setup-input
object while keeping the call site concise.

### 3. Make `setup(...)` Receive `input`

`GameSetupContext` should become:

```ts
export interface GameSetupContext<
  GameState extends object = object,
  SetupInput extends object | undefined = undefined,
> {
  game: GameState;
  runtime: RuntimeState;
  rng: RNGApi;
  input: SetupInput;
}
```

If a game does not declare setup input, `input` is `undefined` and the
developer should not need to use it.

If a game declares setup input, `setup(...)` receives the typed object.

This replaces the current hard-coded `playerIds` field on setup context.

### 4. Typing Behavior Of `createInitialState(...)`

`createInitialState(...)` should change shape depending on whether
`setupInput(...)` was declared.

Target typing:

- without setup input:

```ts
createInitialState(rngSeed: string | number): CanonicalState<TGame>;
```

- with setup input:

```ts
createInitialState(
  input: TSetupInput,
  rngSeed: string | number,
): CanonicalState<TGame>;
```

This is preferable to flattening engine-owned and game-owned inputs into one
object because:

- there is no reserved-key collision
- the game-defined setup input remains exactly the declared `t.object(...)`
  shape
- `rngSeed` remains clearly engine-owned

### 5. Validation Rules

The engine should validate:

- `setupInput(...)` schema is an object schema
- `createInitialState(...)` input conforms to the declared setup schema
- `rngSeed` is provided
- `setup(...)` cannot be called with setup input if no setup schema was
  declared incorrectly

Likely failure modes:

- `setup_input_schema_must_be_object`
- `setup_input_required`
- `rng_seed_required`

Exact error naming can be refined during implementation, but failures should be
explicit and early.

## Splendor Example After Redesign

```ts
export function createSplendorGame() {
  const { initialStage } = createSplendorStages();

  return new GameDefinitionBuilder("splendor")
    .rootState(SplendorRootState)
    .setupInput(
      t.object({
        playerIds: t.array(t.string()),
      }),
    )
    .setup(({ game, rng, input }) => {
      setupSplendorGame(game, rng, input.playerIds);
    })
    .initialStage(initialStage)
    .build();
}

export function createSplendorExecutor() {
  return createGameExecutor(createSplendorGame());
}

const executor = createSplendorExecutor();
const state = executor.createInitialState(
  {
    playerIds: ["p1", "p2"],
  },
  "seed-123",
);
```

This is cleaner than the current factory-closure approach because:

- the game definition owns the setup contract
- session input is explicit at executor call sites
- CLI tooling can inspect the setup schema

## CLI Impact

This redesign directly addresses the gap documented in
[2026-04-14-cli-current-gaps.md](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-14-cli-current-gaps.md).

Once the engine owns setup input:

- CLI no longer needs to guess factory arguments like
  `{ playerIds: ["player-1", "player-2"] }`
- CLI can read the setup-input schema from the built game definition
- validation and artifact generation can require explicit setup input where
  needed

This change should be treated as the prerequisite for cleaning up CLI game
loading.

## Migration Notes

Expected migration steps for game packages:

- remove game-factory setup options that only exist to feed `.setup(...)`
- stop calling `.rngSeed(...)` on `GameDefinitionBuilder`
- declare setup input through `.setupInput(t.object(...))`
- pass session input and seed into `createInitialState(...)`

Expected migration steps for engine consumers:

- update `createInitialState(...)` call sites
- stop relying on engine-provided `playerIds` in `setup(...)`

## Non-Goals

This redesign does not attempt to solve:

- visibility typing
- trigger / stack / queue engine work
- protocol changes beyond setup-input exposure where needed

It is narrowly about making session initialization an explicit engine-owned
contract.
