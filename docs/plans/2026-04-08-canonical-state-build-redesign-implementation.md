# Canonical State Build Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `GameDefinitionBuilder` and `GameExecutor` so the engine derives default canonical game state and canonical game-state schema from `rootState(...)`, removes game-definition `initialState(...)`, validates canonical `{ game, runtime }` state, and migrates Splendor to the new setup model.

**Architecture:** Keep decorated state classes as the single source of truth. `build()` should compile state-facade metadata, canonical game-state schema, default canonical game state, and the runtime schema inputs needed for validation. `createInitialState()` should clone default canonical game state, validate game and runtime, run `setup(...)`, and then initialize progression. Multi-active memory should move from a type-only contract to a schema-plus-initializer contract so runtime validation can include stage memory.

**Tech Stack:** TypeScript, Bun, existing `t.*` schema system, state-facade metadata/compile/hydrate pipeline, stage-machine progression runtime.

---

### Task 1: Lock the new builder and executor contract with failing tests

**Files:**

- Modify: `packages/tabletop-engine/tests/game-execution.test.ts`
- Modify: `packages/tabletop-engine/tests/types.test.ts`
- Modify: `examples/splendor-terminal/tests/actions.test.ts`

**Step 1: Write failing builder/runtime tests**

Add tests that assert:

- games without `rootState(...)` fail at `build()`
- `initialState(...)` is no longer part of the builder contract
- missing required field defaults fail during `createInitialState()`
- missing nested `t.state(...)` fields are auto-created
- missing `t.optional(...)` fields remain `undefined`
- incoming executor state with invalid runtime memory fails validation once memory schema exists

**Step 2: Run targeted tests to verify they fail**

Run:

```bash
bun test --cwd packages/tabletop-engine
```

Expected:

- failures around missing builder artifacts and missing initialization behavior

**Step 3: Add type-level failing coverage**

Add type assertions that:

- built games expose inferred canonical game/runtime state more cleanly
- multi-active `.memory(...)` requires schema plus initializer
- command-bearing stage hooks still infer command unions after builder changes

**Step 4: Run the type tests**

Run:

```bash
bunx tsc -b
```

Expected:

- compile failures before implementation

**Step 5: Commit**

```bash
git add packages/tabletop-engine/tests/game-execution.test.ts packages/tabletop-engine/tests/types.test.ts examples/splendor-terminal/tests/actions.test.ts
git commit -m "test: lock canonical state build redesign"
```

### Task 2: Compile canonical game schema and default canonical game state in the builder

**Files:**

- Modify: `packages/tabletop-engine/src/game-definition.ts`
- Modify: `packages/tabletop-engine/src/state-facade/compile.ts`
- Create: `packages/tabletop-engine/src/state-facade/canonical.ts`
- Modify: `packages/tabletop-engine/src/state-facade/metadata.ts`
- Modify: `packages/tabletop-engine/src/schema/index.ts`
- Modify: `packages/tabletop-engine/src/index.ts`

**Step 1: Add canonical-state compilation helpers**

Implement helpers that:

- compile one `canonicalGameStateSchema` from the compiled root facade metadata
- derive one `defaultCanonicalGameState` from the root state class
- recursively:
  - read initialized field values
  - auto-create nested `t.state(...)`
  - preserve missing `t.optional(...)` as `undefined`
  - throw on other missing fields
  - dehydrate state instances to plain serializable data

**Step 2: Update `GameDefinition` and `GameDefinitionBuilder`**

Change the builder so it:

- requires `rootState(...)`
- removes `initialState(...)`
- stores:
  - `canonicalGameStateSchema`
  - `defaultCanonicalGameState`
- keeps `stateFacade`, `stages`, `commands`, `setup`, and RNG data

**Step 3: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine
bunx tsc -b
```

Expected:

- builder/default-state tests now pass
- remaining executor/setup migration tests may still fail

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/game-definition.ts packages/tabletop-engine/src/state-facade/compile.ts packages/tabletop-engine/src/state-facade/canonical.ts packages/tabletop-engine/src/state-facade/metadata.ts packages/tabletop-engine/src/schema/index.ts packages/tabletop-engine/src/index.ts packages/tabletop-engine/tests/game-execution.test.ts packages/tabletop-engine/tests/types.test.ts
git commit -m "feat: compile canonical game state artifacts"
```

### Task 3: Redesign multi-active memory to carry runtime schema

**Files:**

- Modify: `packages/tabletop-engine/src/stage-factory.ts`
- Modify: `packages/tabletop-engine/src/types/progression.ts`
- Modify: `packages/tabletop-engine/src/runtime/game-executor.ts`
- Modify: `packages/tabletop-engine/tests/game-execution.test.ts`
- Modify: `packages/tabletop-engine/tests/types.test.ts`

**Step 1: Change the builder API**

Replace:

```ts
.memory<T>(() => initialMemory)
```

with:

```ts
.memory(
  t.object({ ... }),
  () => initialMemory,
)
```

Require:

- top-level `t.object(...)`
- no `t.state(...)`

Reuse the same serializable-schema validation path already used for command and discovery input schemas.

**Step 2: Thread memory schema through stage definitions**

Ensure reachable multi-active stages retain:

- memory schema
- memory initializer

so runtime validation can later assemble stage-specific memory branches.

**Step 3: Update executor calls**

Keep runtime memory on:

- `runtime.progression.currentStage.memory`

and ensure initialization still creates memory via the new initializer.

**Step 4: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine
bunx tsc -b
```

Expected:

- multi-active stage tests pass with the new API

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/stage-factory.ts packages/tabletop-engine/src/types/progression.ts packages/tabletop-engine/src/runtime/game-executor.ts packages/tabletop-engine/tests/game-execution.test.ts packages/tabletop-engine/tests/types.test.ts
git commit -m "refactor: add schema-backed multi-active memory"
```

### Task 4: Validate full canonical `{ game, runtime }` state in the executor

**Files:**

- Modify: `packages/tabletop-engine/src/runtime/game-executor.ts`
- Create: `packages/tabletop-engine/src/runtime/schema.ts`
- Modify: `packages/tabletop-engine/src/types/state.ts`
- Modify: `packages/tabletop-engine/src/testing/harness.ts`
- Modify: `packages/tabletop-engine/tests/game-execution.test.ts`

**Step 1: Add engine-owned runtime schema assembly**

Create a runtime schema helper that covers:

- `rng`
- `history`
- `progression`
- `currentStage`
- `lastActingStage`

and plugs in per-stage multi-active memory schemas for reachable stages.

**Step 2: Validate initial and incoming state**

Update `createInitialState()` to:

- clone `defaultCanonicalGameState`
- validate `game`
- create empty runtime
- run `setup(...)`
- initialize stages
- validate `runtime`
- return canonical `{ game, runtime }`

Update `executeCommand(...)`, `listAvailableCommands(...)`, `discoverCommand(...)`, and `getView(...)` entry paths to validate incoming canonical state before use.

**Step 3: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine
```

Expected:

- executor validation tests pass
- example packages may still fail until migrated

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/runtime/game-executor.ts packages/tabletop-engine/src/runtime/schema.ts packages/tabletop-engine/src/types/state.ts packages/tabletop-engine/src/testing/harness.ts packages/tabletop-engine/tests/game-execution.test.ts
git commit -m "feat: validate canonical game and runtime state"
```

### Task 5: Migrate Splendor to root-state defaults plus setup

**Files:**

- Modify: `examples/splendor/src/game.ts`
- Modify: `examples/splendor/src/state.ts`
- Modify: `examples/splendor/src/states/player-state.ts`
- Modify: `examples/splendor/src/states/board-state.ts`
- Modify: `examples/splendor/src/states/game-state.ts`
- Modify: `examples/splendor/src/states/token-counts-state.ts`
- Modify: `examples/splendor/src/stages/*.ts`
- Modify: `examples/splendor/src/game.test.ts`
- Modify: `examples/splendor-terminal/src/session.ts`
- Modify: `examples/splendor-terminal/tests/actions.test.ts`

**Step 1: Move defaults onto decorated fields**

Initialize non-state fields directly on state classes where appropriate, for example:

- arrays as `[]`
- records as `{}`
- numeric counters as `0`

Leave nested `t.state(...)` fields unset unless explicit override is actually needed.

**Step 2: Remove game-definition `initialState()` usage**

Make Splendor authoring use:

- `.rootState(...)`
- `.setup(...)`

and move setup-only logic there:

- player ids
- shuffled decks
- bank population
- face-up market fill
- nobles / player collections as needed

**Step 3: Simplify terminal typing**

Use the cleaner inferred canonical state surface from the redesigned builder/executor so `session.ts` no longer needs to guess state shape from facade classes.

**Step 4: Run example tests**

Run:

```bash
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected:

- Splendor setup and terminal flow pass under the new builder model

**Step 5: Commit**

```bash
git add examples/splendor/src/game.ts examples/splendor/src/state.ts examples/splendor/src/states/player-state.ts examples/splendor/src/states/board-state.ts examples/splendor/src/states/game-state.ts examples/splendor/src/states/token-counts-state.ts examples/splendor/src/stages examples/splendor/src/game.test.ts examples/splendor-terminal/src/session.ts examples/splendor-terminal/tests/actions.test.ts
git commit -m "refactor: migrate splendor to canonical root defaults"
```

### Task 6: Full verification and cleanup

**Files:**

- Modify: `packages/tabletop-engine/src/index.ts`
- Modify: `docs/design/2026-04-08-root-state-default-initialization-design.md`
- Modify: `docs/design/2026-04-08-game-definition-build-pipeline-redesign.md`

**Step 1: Remove dead builder/runtime artifacts**

Delete obsolete code paths left behind by removing `initialState(...)` and the old multi-active memory API.

**Step 2: Update exports and docs if implementation details shifted**

Keep exported types and design docs aligned with the final code.

**Step 3: Run full verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected:

- all commands pass

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/index.ts docs/design/2026-04-08-root-state-default-initialization-design.md docs/design/2026-04-08-game-definition-build-pipeline-redesign.md
git commit -m "refactor: finalize canonical state build redesign"
```
