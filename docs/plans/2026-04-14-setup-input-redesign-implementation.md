# Setup Input Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move game-specific setup input and required `rngSeed` to the
`createInitialState(...)` boundary, so the engine owns session initialization
instead of game factories capturing setup data in closures.

**Architecture:** Add a new `SetupInput` generic to the game-definition and
executor pipeline, sourced from `setupInput(t.object(...))`. Remove
builder-level `.rngSeed(...)`, replace hard-coded `playerIds` setup context with
typed `input`, and make `createInitialState(...)` conditionally typed as either
`(rngSeed)` or `(input, rngSeed)`. The schema layer already exposes
`ObjectSchemaStatic<TProperties>`, so setup-input static typing can come
directly from `t.object(...)`.

**Tech Stack:** TypeScript, Bun, `@sinclair/typebox`, Bun test

---

## Spike Findings

The worktree spike in `.worktrees/setup-input-redesign-spike` confirmed:

- `packages/tabletop-engine/src/schema/types.ts` already exposes
  `ObjectSchemaStatic<TProperties>`, so `setupInput(t.object(...))` can produce
  an exact static input type without new schema machinery.
- The blast radius is larger than the initial design note:
  - `packages/tabletop-engine/src/game-definition.ts`
  - `packages/tabletop-engine/src/runtime/game-executor.ts`
  - `packages/tabletop-engine/src/testing/harness.ts`
  - `packages/cli/src/lib/load-game.ts`
  - `examples/splendor/src/game.ts`
  - `examples/splendor-terminal/src/session.ts`
  - many engine/example tests calling `createInitialState()` with no args or
    relying on `playerIds` in `setup(...)`
- The current `GameExecutor` interface and testing harness assume a single
  zero-arg `createInitialState()` shape, so both need to be redesigned rather
  than patched ad hoc.

These findings are incorporated into the tasks below.

### Task 1: Lock the new setup-input typing with failing tests

**Files:**

- Modify: `packages/tabletop-engine/tests/types.test.ts`
- Test: `packages/tabletop-engine/tests/types.test.ts`

**Step 1: Write failing type tests for setup-input builder typing**

Add tests covering:

- games without `setupInput(...)` expose:

```ts
const noInputExecutor = createGameExecutor(
  new GameDefinitionBuilder("no-input")
    .rootState(TypedCounterRootState)
    .initialStage(noInputStage)
    .build(),
);

noInputExecutor.createInitialState("seed-123");
// @ts-expect-error no setup input should not be accepted
noInputExecutor.createInitialState({ playerIds: ["p1"] }, "seed-123");
```

- games with `setupInput(t.object(...))` expose:

```ts
const setupSchema = t.object({
  playerIds: t.array(t.string()),
});

const inputExecutor = createGameExecutor(
  new GameDefinitionBuilder("with-input")
    .rootState(TypedCounterRootState)
    .setupInput(setupSchema)
    .setup(({ input }) => {
      const typedPlayerIds: string[] = input.playerIds;
      expect(typedPlayerIds).toBeArray();
    })
    .initialStage(inputStage)
    .build(),
);

inputExecutor.createInitialState({ playerIds: ["p1", "p2"] }, "seed-123");
// @ts-expect-error rngSeed must be required
inputExecutor.createInitialState({ playerIds: ["p1", "p2"] });
// @ts-expect-error input is required when setupInput is declared
inputExecutor.createInitialState("seed-123");
```

- `setupInput(...)` rejects non-object schemas:

```ts
// @ts-expect-error setupInput only accepts object schemas
new GameDefinitionBuilder("invalid").setupInput(t.string());
```

**Step 2: Run test to verify it fails**

Run:

```bash
bun test --cwd packages/tabletop-engine ./tests/types.test.ts
```

Expected: type test failures because `setupInput(...)` and the new
`createInitialState(...)` signatures do not exist yet.

**Step 3: Commit**

Do not commit until the implementation for this task passes.

### Task 2: Add `SetupInput` generics to game-definition types

**Files:**

- Modify: `packages/tabletop-engine/src/game-definition.ts`
- Modify: `packages/tabletop-engine/src/schema/index.ts`
- Modify: `packages/tabletop-engine/src/index.ts`
- Test: `packages/tabletop-engine/tests/types.test.ts`

**Step 1: Add setup-input type aliases in `game-definition.ts`**

Introduce:

```ts
import type { ObjectFieldType, ObjectSchemaStatic, FieldType } from "./schema";

type NoSetupInput = undefined;

type SetupInputFromSchema<
  TSchema extends ObjectFieldType<Record<string, FieldType>> | undefined,
> =
  TSchema extends ObjectFieldType<infer TProperties>
    ? ObjectSchemaStatic<TProperties>
    : NoSetupInput;
```

**Step 2: Thread `SetupInput` through public interfaces**

Extend:

- `GameSetupContext<GameState, SetupInput>`
- `GameDefinition<CanonicalGameState, FacadeGameState, Commands, SetupInput>`
- `GameDefinitionInput<...>`
- `GameDefinitionBuilderState<...>`
- `GameDefinitionBuilder<FacadeGameState, CanonicalGameState, Commands, SetupInput>`

Store:

```ts
setupInputSchema?: ObjectFieldType<Record<string, FieldType>>;
```

and:

```ts
setup?: (context: GameSetupContext<FacadeGameState, SetupInput>) => void;
```

**Step 3: Add `setupInput(...)` builder method**

Implement:

```ts
setupInput<TSchema extends ObjectFieldType<Record<string, FieldType>>>(
  schema: TSchema,
): GameDefinitionBuilder<
  FacadeGameState,
  CanonicalGameState,
  Commands,
  SetupInputFromSchema<TSchema>
> {
  this.config.setupInputSchema = schema;
  return this as unknown as GameDefinitionBuilder<
    FacadeGameState,
    CanonicalGameState,
    Commands,
    SetupInputFromSchema<TSchema>
  >;
}
```

**Step 4: Remove builder-level `rngSeed(...)`**

Delete:

```ts
rngSeed(rngSeed: string | number | undefined): this
```

and remove `rngSeed` from `GameDefinition`, `GameDefinitionInput`,
`GameDefinitionBuilderState`, and the built return object.

**Step 5: Run type tests**

Run:

```bash
bun test --cwd packages/tabletop-engine ./tests/types.test.ts
```

Expected: type tests still fail on executor/runtime call shapes, but builder
typing compiles.

**Step 6: Commit**

```bash
git add packages/tabletop-engine/src/game-definition.ts packages/tabletop-engine/src/schema/index.ts packages/tabletop-engine/src/index.ts packages/tabletop-engine/tests/types.test.ts
git commit -m "refactor: add setup input to game definitions"
```

### Task 3: Redesign `GameExecutor.createInitialState(...)`

**Files:**

- Modify: `packages/tabletop-engine/src/runtime/game-executor.ts`
- Modify: `packages/tabletop-engine/src/runtime/validation.ts`
- Test: `packages/tabletop-engine/tests/game-definition.test.ts`
- Test: `packages/tabletop-engine/tests/game-execution.test.ts`
- Test: `packages/tabletop-engine/tests/types.test.ts`

**Step 1: Define conditional create-initial-state function types**

In `game-executor.ts`, add:

```ts
type RngSeed = string | number;

type CreateInitialStateFn<
  GameState extends object,
  SetupInput extends object | undefined,
> = [SetupInput] extends [undefined]
  ? (rngSeed: RngSeed) => CanonicalState<GameState>
  : (input: SetupInput, rngSeed: RngSeed) => CanonicalState<GameState>;
```

Update `GameExecutor<GameState, SetupInput>`:

```ts
export interface GameExecutor<
  GameState extends object,
  SetupInput extends object | undefined = undefined,
> {
  createInitialState: CreateInitialStateFn<GameState, SetupInput>;
  ...
}
```

**Step 2: Implement runtime argument normalization**

Inside `createGameExecutor(...)`, normalize arguments based on whether
`game.setupInputSchema` exists:

```ts
const hasSetupInput = !!game.setupInputSchema;

const normalizedInput = hasSetupInput ? firstArg : undefined;
const normalizedSeed = hasSetupInput ? secondArg : firstArg;
```

Validate:

- `normalizedSeed` exists
- if `hasSetupInput`, `normalizedInput` exists
- if `hasSetupInput`, `assertSchemaValue(game.setupInputSchema, normalizedInput)`

Suggested explicit errors:

- `rng_seed_required`
- `setup_input_required`

**Step 3: Move RNG initialization to the normalized seed**

Replace the current `game.rngSeed ?? 0` runtime initialization with:

```ts
seed: normalizedSeed,
```

**Step 4: Pass `input` into `setup(...)`**

Replace:

```ts
playerIds: options?.playerIds ?? [],
```

with:

```ts
input: normalizedInput as SetupInput,
```

**Step 5: Add failing runtime tests before implementation**

In `game-execution.test.ts`, add tests for:

- `createInitialState()` throws `rng_seed_required`
- game with `setupInput(...)` throws `setup_input_required` when called with
  only a seed
- invalid setup input throws `invalid_schema_value`

In `game-definition.test.ts`, add tests for:

- `setupInput(t.string())` cannot compile or is rejected at the type boundary
- built game includes `setupInputSchema`

**Step 6: Run focused tests**

Run:

```bash
bun test --cwd packages/tabletop-engine ./tests/types.test.ts ./tests/game-definition.test.ts ./tests/game-execution.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/tabletop-engine/src/runtime/game-executor.ts packages/tabletop-engine/src/runtime/validation.ts packages/tabletop-engine/tests/types.test.ts packages/tabletop-engine/tests/game-definition.test.ts packages/tabletop-engine/tests/game-execution.test.ts
git commit -m "refactor: move setup input to createInitialState"
```

### Task 4: Update the testing harness and helper abstractions

**Files:**

- Modify: `packages/tabletop-engine/src/testing/harness.ts`
- Test: `packages/tabletop-engine/tests/replay.test.ts`

**Step 1: Generalize the harness executor contract**

Change:

```ts
createInitialState(): State;
```

to accept the minimal required session seed:

```ts
createInitialState(...args: unknown[]): State;
```

Then update `runScenario(...)` to take initialization arguments explicitly:

```ts
export function runScenario<State extends CanonicalState, TCommandInput extends Command>(
  gameExecutor: { createInitialState(...args: unknown[]): State; ... },
  commands: TCommandInput[],
  ...initialStateArgs: unknown[]
)
```

and call:

```ts
const initialState = gameExecutor.createInitialState(...initialStateArgs);
```

**Step 2: Update replay/scenario call sites**

Any tests or utilities that assume zero-arg `createInitialState()` need to pass
the seed explicitly.

**Step 3: Run focused tests**

Run:

```bash
bun test --cwd packages/tabletop-engine ./tests/replay.test.ts ./tests/game-execution.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/testing/harness.ts packages/tabletop-engine/tests/replay.test.ts packages/tabletop-engine/tests/game-execution.test.ts
git commit -m "refactor: pass session init args through test harness"
```

### Task 5: Migrate Splendor to engine-owned setup input

**Files:**

- Modify: `examples/splendor/src/game.ts`
- Modify: `examples/splendor/src/setup.ts`
- Modify: `examples/splendor/tests/game.test.ts`
- Modify: `examples/splendor/src/generate-asyncapi.ts`

**Step 1: Remove setup closure capture from Splendor**

Change `createSplendorGame(...)` to zero-arg:

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
```

Change `createSplendorExecutor()` to zero-arg:

```ts
export function createSplendorExecutor() {
  return createGameExecutor(createSplendorGame());
}
```

**Step 2: Update Splendor tests to pass input and seed**

Replace zero-arg initialization:

```ts
const state = gameExecutor.createInitialState();
```

with:

```ts
const state = gameExecutor.createInitialState(
  { playerIds: ["p1", "p2"] },
  "test-seed",
);
```

Where helper functions already know the player ids, thread the seed explicitly
through the helper.

**Step 3: Update AsyncAPI generation entrypoint**

`examples/splendor/src/generate-asyncapi.ts` should create the game without
passing setup options at build time.

**Step 4: Run example tests**

Run:

```bash
bun test --cwd examples/splendor
```

Expected: PASS

**Step 5: Commit**

```bash
git add examples/splendor/src/game.ts examples/splendor/src/setup.ts examples/splendor/tests/game.test.ts examples/splendor/src/generate-asyncapi.ts
git commit -m "refactor: move splendor setup input to executor initialization"
```

### Task 6: Update the terminal example to use the new executor API

**Files:**

- Modify: `examples/splendor-terminal/src/session.ts`
- Test: `examples/splendor-terminal`

**Step 1: Update terminal session initialization**

Replace:

```ts
const initialState = gameExecutor.createInitialState({
  playerIds: [...DEFAULT_PLAYER_IDS],
});
```

with:

```ts
const initialState = gameExecutor.createInitialState(
  { playerIds: [...DEFAULT_PLAYER_IDS] },
  "splendor-terminal",
);
```

If a stronger seed strategy is preferred later, keep the string literal for now
and document it as local-session convenience.

**Step 2: Run terminal tests**

Run:

```bash
bun test --cwd examples/splendor-terminal
```

Expected: PASS

**Step 3: Commit**

```bash
git add examples/splendor-terminal/src/session.ts
git commit -m "refactor: update terminal session initialization api"
```

### Task 7: Update CLI loading and validation around setup input

**Files:**

- Modify: `packages/cli/src/lib/load-game.ts`
- Modify: `packages/cli/src/commands/validate.ts`
- Modify: `packages/cli/tests/validate.test.ts`
- Modify: `docs/design/2026-04-14-cli-current-gaps.md`

**Step 1: Stop guessing build-time game factory setup**

Because Splendor-style setup moves to executor initialization, `loadGame(...)`
should stop assuming nonzero-arity factories need:

```ts
{
  playerIds: ["player-1", "player-2"],
}
```

Instead:

- support built game exports directly
- support zero-arg game factories returning built definitions
- reject unsupported parameterized factories clearly

Suggested failure:

```ts
throw new Error("game_factory_with_runtime_parameters_not_supported");
```

**Step 2: Update `validate` tests**

Snapshot validation tests must pass the new `createInitialState(...)` arguments
when constructing example states.

**Step 3: Refresh the CLI gap doc**

Update [2026-04-14-cli-current-gaps.md](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-14-cli-current-gaps.md)
to note that the original factory-guessing problem is now addressed at the
engine API level, and the remaining CLI work is explicit runtime setup-input
support.

**Step 4: Run CLI tests**

Run:

```bash
bun test --cwd packages/cli
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/load-game.ts packages/cli/src/commands/validate.ts packages/cli/tests/validate.test.ts docs/design/2026-04-14-cli-current-gaps.md
git commit -m "refactor: align cli loading with setup input api"
```

### Task 8: Full verification and cleanup

**Files:**

- Modify: any touched files from earlier tasks

**Step 1: Run full repo verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
bun test --cwd packages/cli
```

Expected: PASS

**Step 2: Review for leftover legacy API**

Search for:

```bash
rg -n "rngSeed\\(|playerIds: options\\?|createInitialState\\(\\)" packages examples
```

Check that:

- builder-level `.rngSeed(...)` is gone
- `GameSetupContext` no longer exposes `playerIds`
- the remaining zero-arg `createInitialState()` references are intentional test
  doubles only

**Step 3: Commit final cleanup**

```bash
git add packages/tabletop-engine packages/cli examples/splendor examples/splendor-terminal docs/design/2026-04-14-cli-current-gaps.md
git commit -m "refactor: finalize setup input redesign"
```
