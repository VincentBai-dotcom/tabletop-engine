# Game Definition Validation Gap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the validation and canonical-type follow-up from the game-definition build redesign by validating incoming canonical state, assembling an engine-owned runtime schema, and exposing a trustworthy canonical state type surface.

**Architecture:** Keep `canonicalGameStateSchema` as the consumer-authored game-data artifact and add a parallel engine-owned `runtimeStateSchema` for `state.runtime`. Validation should happen at canonical boundaries through three narrowly named helpers: `validateCanonicalGameState`, `validateRuntimeState`, and `validateCanonicalState`. Static DX should be fixed separately but in the same slice by deriving canonical plain-data types from the root facade type and exporting `CanonicalGameStateOf<TGame>` and `CanonicalStateOf<TGame>` helpers.

**Tech Stack:** TypeScript, Bun, TypeBox-backed `t` schemas, tabletop-engine runtime/state-facade system

---

## Naming Decisions

Use these names consistently in code:

- `runtimeStateSchema`
  the engine-owned schema for `state.runtime`
- `validateCanonicalGameState(...)`
  validates `state.game` against `canonicalGameStateSchema`
- `validateRuntimeState(...)`
  validates `state.runtime` against `runtimeStateSchema`
- `validateCanonicalState(...)`
  validates the full `{ game, runtime }` envelope by delegating to the two helpers above
- `CanonicalGameStateOf<TGame>`
  exported helper for the plain canonical `game` subtree type
- `CanonicalStateOf<TGame>`
  exported helper for the full `{ game, runtime }` state type
- `CanonicalDataFromFacade<TFacade>`
  internal type utility that strips methods and recursively maps hydrated facade state into plain canonical data

Avoid introducing alternate names like `compiledValidator`, `stateValidator`, or `canonicalRuntimeStateSchema`.

### Task 1: Add schema-backed runtime validation helpers

**Files:**

- Create: `packages/tabletop-engine/src/runtime/validation.ts`
- Modify: `packages/tabletop-engine/src/schema/index.ts`
- Modify: `packages/tabletop-engine/src/index.ts`
- Test: `packages/tabletop-engine/tests/schema.test.ts`

**Step 1: Write the failing test**

Add tests that prove the engine can reject invalid plain values against object schemas built from `t`, including nested `optional`, `array`, and `record` branches.

**Step 2: Run test to verify it fails**

Run: `bun test ./packages/tabletop-engine/tests/schema.test.ts`
Expected: FAIL because no runtime value-validation helper exists yet.

**Step 3: Write minimal implementation**

Create a reusable validation module that:

- reads the hidden TypeBox schema already attached to `FieldType` / `ObjectFieldType`
- validates a runtime value against it
- throws an engine-owned error with a stable prefix such as `invalid_schema_value:...`

Implementation direction:

- add a helper like `assertSchemaValue(schema, value, path)`
- use TypeBox value validation under the hood rather than hand-rolling a second validator
- keep the helper narrow and internal first

**Step 4: Run test to verify it passes**

Run: `bun test ./packages/tabletop-engine/tests/schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/runtime/validation.ts packages/tabletop-engine/src/schema/index.ts packages/tabletop-engine/src/index.ts packages/tabletop-engine/tests/schema.test.ts
git commit -m "feat: add schema-backed value validation"
```

### Task 2: Assemble `runtimeStateSchema` during game-definition build

**Files:**

- Modify: `packages/tabletop-engine/src/game-definition.ts`
- Create: `packages/tabletop-engine/src/runtime/runtime-schema.ts`
- Modify: `packages/tabletop-engine/src/types/progression.ts`
- Test: `packages/tabletop-engine/tests/game-definition.test.ts`

**Step 1: Write the failing test**

Add builder tests that assert:

- built games expose `runtimeStateSchema`
- the schema includes multi-active stage `memorySchema`
- duplicate stage ids still fail before runtime schema assembly proceeds

**Step 2: Run test to verify it fails**

Run: `bun test ./packages/tabletop-engine/tests/game-definition.test.ts`
Expected: FAIL because `GameDefinition` does not yet expose `runtimeStateSchema`.

**Step 3: Write minimal implementation**

Create a runtime schema compiler that:

- produces one engine-owned `runtimeStateSchema`
- models `progression`, `rng`, and `history`
- plugs reachable multi-active `memorySchema` into the `currentStage` and `lastActingStage` shapes where relevant

Implementation direction:

- do not expand the public `t` API just for this
- build `runtimeStateSchema` directly as an engine-owned TypeBox schema if that keeps the shape clean
- keep `canonicalGameStateSchema` as-is; only the runtime half needs this internal assembly step

**Step 4: Run test to verify it passes**

Run: `bun test ./packages/tabletop-engine/tests/game-definition.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/game-definition.ts packages/tabletop-engine/src/runtime/runtime-schema.ts packages/tabletop-engine/src/types/progression.ts packages/tabletop-engine/tests/game-definition.test.ts
git commit -m "feat: assemble runtime state schema"
```

### Task 3: Validate canonical state at executor boundaries

**Files:**

- Modify: `packages/tabletop-engine/src/runtime/game-executor.ts`
- Modify: `packages/tabletop-engine/src/runtime/validation.ts`
- Test: `packages/tabletop-engine/tests/game-execution.test.ts`
- Test: `packages/tabletop-engine/tests/replay.test.ts`

**Step 1: Write the failing test**

Add runtime tests that prove the executor rejects:

- invalid `state.game`
- invalid `state.runtime`
- invalid replay/snapshot state when it re-enters the executor

Also add tests that `createInitialState()` validates:

- cloned `defaultCanonicalGameState`
- post-`setup(...)` game state
- runtime after stage initialization

**Step 2: Run test to verify it fails**

Run: `bun test ./packages/tabletop-engine/tests/game-execution.test.ts`
Run: `bun test ./packages/tabletop-engine/tests/replay.test.ts`
Expected: FAIL because executor APIs do not yet validate incoming canonical state.

**Step 3: Write minimal implementation**

Add the three validation helpers:

- `validateCanonicalGameState(gameDefinition, gameState)`
- `validateRuntimeState(gameDefinition, runtimeState)`
- `validateCanonicalState(gameDefinition, state)`

Then call them in:

- `createInitialState()` after cloning defaults
- `createInitialState()` after `setup(...)`
- `createInitialState()` after stage initialization
- `getView(...)`
- `listAvailableCommands(...)`
- `discoverCommand(...)`
- `executeCommand(...)`

Implementation direction:

- validate as close to ingress as possible
- do not hydrate facades until validation has passed
- validate replay/snapshot flows through the executor path rather than inventing a second replay-only validator

**Step 4: Run test to verify it passes**

Run: `bun test ./packages/tabletop-engine/tests/game-execution.test.ts`
Run: `bun test ./packages/tabletop-engine/tests/replay.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/runtime/game-executor.ts packages/tabletop-engine/src/runtime/validation.ts packages/tabletop-engine/tests/game-execution.test.ts packages/tabletop-engine/tests/replay.test.ts
git commit -m "feat: validate canonical state at executor boundaries"
```

### Task 4: Fix canonical plain-data typing and export helpers

**Files:**

- Modify: `packages/tabletop-engine/src/game-definition.ts`
- Modify: `packages/tabletop-engine/src/types/state.ts`
- Modify: `packages/tabletop-engine/src/index.ts`
- Test: `packages/tabletop-engine/tests/types.test.ts`
- Modify: `examples/splendor-terminal/src/session.ts`
- Modify: `examples/splendor-terminal/src/types.ts`
- Test: `examples/splendor-terminal/tests/actions.test.ts`

**Step 1: Write the failing test**

Add type tests that prove:

- `rootState(MyState)` produces canonical game data typed as plain data, not the facade class
- `CanonicalGameStateOf<typeof game>` resolves to the plain `game` shape
- `CanonicalStateOf<typeof game>` resolves to `{ game, runtime }`

Also add/update the Splendor terminal types so they use the helper rather than `CanonicalState<SplendorGameState>`.

**Step 2: Run test to verify it fails**

Run: `bun test ./packages/tabletop-engine/tests/types.test.ts`
Run: `bun test ./examples/splendor-terminal/tests/actions.test.ts`
Expected: FAIL because the common `rootState(...)` path still infers canonical state as the facade class.

**Step 3: Write minimal implementation**

Add an internal recursive type utility:

- `CanonicalDataFromFacade<TFacade>`

Rules:

- drop function-valued properties
- recursively map arrays
- recursively map records/objects
- preserve primitives
- recursively map nested state-class fields into plain object data

Then:

- wire `GameDefinitionBuilder.rootState(...)` so `CanonicalGameState` becomes `CanonicalDataFromFacade<NextFacadeGameState>` in the common path
- export `CanonicalGameStateOf<TGame>`
- export `CanonicalStateOf<TGame>`
- migrate `splendor-terminal` to the helper types

**Step 4: Run test to verify it passes**

Run: `bun test ./packages/tabletop-engine/tests/types.test.ts`
Run: `bun test ./examples/splendor-terminal/tests/actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/game-definition.ts packages/tabletop-engine/src/types/state.ts packages/tabletop-engine/src/index.ts packages/tabletop-engine/tests/types.test.ts examples/splendor-terminal/src/session.ts examples/splendor-terminal/src/types.ts examples/splendor-terminal/tests/actions.test.ts
git commit -m "feat: expose canonical state type helpers"
```

### Task 5: Final verification and cleanup

**Files:**

- Verify only

**Step 1: Run full verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected: all green

**Step 2: Review variable names and error strings**

Check that the implementation consistently uses:

- `runtimeStateSchema`
- `validateCanonicalGameState`
- `validateRuntimeState`
- `validateCanonicalState`
- `CanonicalGameStateOf`
- `CanonicalStateOf`

Rename any drift before finalizing.

**Step 3: Commit cleanup if needed**

```bash
git add <touched-files>
git commit -m "refactor: polish canonical state validation names"
```
