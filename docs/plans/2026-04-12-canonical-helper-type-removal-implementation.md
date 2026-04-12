# Canonical Helper Type Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove `CanonicalDataFromFacade`, `CanonicalGameStateOf`, and `CanonicalStateOf` from the engine’s primary type surface by making `GameDefinitionBuilder` and `createGameExecutor(...)` infer canonical state directly from the root state class property types.

**Architecture:** Keep runtime behavior unchanged. The refactor is purely about static typing: rethread `GameDefinitionBuilder` so the canonical game state generic is inferred directly from `rootState(...)`, then migrate remaining consumers and tests off the legacy helper types before deleting the exports. The executor and runtime validation still continue to use `t(...)` for runtime schema generation and validation.

**Tech Stack:** TypeScript, Bun, existing `tabletop-engine` runtime and Splendor example packages.

---

## Gap Summary

The current `main` branch still depends on the canonical helper types in three places:

1. [game-definition.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/game-definition.ts) still threads builder typing through `CanonicalDataFromFacade<FacadeGameState>`.
2. [state.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/types/state.ts) still exports:
   - `CanonicalDataFromFacade<TFacade>`
   - `CanonicalGameStateOf<TGame>`
   - `CanonicalStateOf<TGame>`
3. Consumers/tests still import the legacy helpers:
   - [examples/splendor-terminal/src/types.ts](/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor-terminal/src/types.ts)
   - [packages/tabletop-engine/tests/types.test.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/tests/types.test.ts)

## Naming Decisions

Use these names consistently during the cleanup:

- `RootStateClass`
- `RootState`
- `CanonicalGameState`
- `ExecutorState`
- `defaultCanonicalGameState`

Avoid introducing replacement helper names. The goal is to stop needing them.

### Task 1: Lock the desired inference behavior with failing type tests

**Files:**

- Modify: `packages/tabletop-engine/tests/types.test.ts`

**Step 1: Write the failing type assertions**

Add or revise tests so they assert:

- `new GameDefinitionBuilder(...).rootState(RootState).build()` carries a canonical game state type that matches the root state class property types directly
- `createGameExecutor(game).createInitialState().game` is inferred without `CanonicalGameStateOf`
- `createGameExecutor(game).executeCommand(...).state` is inferred without `CanonicalStateOf`
- there are no tests defending `CanonicalGameStateOf` / `CanonicalStateOf` as part of the public API

Use direct assignment checks instead of helper-type checks, for example:

```ts
const initialState = executor.createInitialState();
const gold: number = initialState.game.players.p1.tokens.gold;
```

**Step 2: Run the focused test to verify it fails**

Run: `bun test --cwd packages/tabletop-engine ./tests/types.test.ts`

Expected: FAIL because the builder and executor still depend on the legacy helper path.

**Step 3: Commit**

```bash
git add packages/tabletop-engine/tests/types.test.ts
git commit -m "test: lock canonical inference without helper types"
```

### Task 2: Remove `CanonicalDataFromFacade` from `GameDefinitionBuilder`

**Files:**

- Modify: `packages/tabletop-engine/src/game-definition.ts`
- Test: `packages/tabletop-engine/tests/types.test.ts`

**Step 1: Update builder generics**

Refactor `GameDefinitionBuilder` so:

- the canonical game state generic is carried explicitly
- `rootState(...)` sets both:
  - `FacadeGameState`
  - `CanonicalGameState`

based on the root state class property type

Do not use `CanonicalDataFromFacade<FacadeGameState>` inside:

- `GameDefinitionBuilderState`
- `build()`

The canonical type should come from the builder generic, not be reconstructed at the end.

**Step 2: Keep runtime return values unchanged**

Do not change runtime behavior:

- `defaultCanonicalGameState`
- `canonicalGameStateSchema`
- `stateFacade`

remain exactly as today

Only remove the helper type dependency from the static return type path.

**Step 3: Run the focused test to verify it passes**

Run: `bun test --cwd packages/tabletop-engine ./tests/types.test.ts`

Expected: PASS for the updated direct inference assertions.

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/game-definition.ts packages/tabletop-engine/tests/types.test.ts
git commit -m "refactor: infer canonical state directly in builder"
```

### Task 3: Migrate remaining consumer code off `CanonicalStateOf`

**Files:**

- Modify: `examples/splendor-terminal/src/types.ts`
- Test: `examples/splendor-terminal/tests/actions.test.ts`
- Test: `examples/splendor-terminal/tests/render.test.ts`
- Test: `examples/splendor-terminal/tests/session.test.ts`

**Step 1: Replace helper-type usage in the terminal example**

Stop importing `CanonicalStateOf`.

Rewrite the terminal’s local state type so it comes from normal executor/game inference.

Preferred direction:

- derive the type from the built game/executor flow already used in the example
- or introduce a local explicit state alias based on the root state class if that reads more clearly

Do not reintroduce a new helper type from the engine.

**Step 2: Run the example test suite**

Run: `bun test --cwd examples/splendor-terminal`

Expected: PASS with no dependency on `CanonicalStateOf`.

**Step 3: Commit**

```bash
git add examples/splendor-terminal/src/types.ts examples/splendor-terminal/tests/actions.test.ts examples/splendor-terminal/tests/render.test.ts examples/splendor-terminal/tests/session.test.ts
git commit -m "refactor: remove canonical helper usage from terminal example"
```

### Task 4: Remove legacy helper exports from the engine

**Files:**

- Modify: `packages/tabletop-engine/src/types/state.ts`
- Modify: `packages/tabletop-engine/src/index.ts`
- Test: `packages/tabletop-engine/tests/types.test.ts`

**Step 1: Delete the helper types**

Remove from [state.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/types/state.ts):

- `CanonicalDataFromFacade`
- `CanonicalGameStateOf`
- `CanonicalStateOf`

Remove the matching exports from [index.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/index.ts).

**Step 2: Remove any stale imports/usages**

Clean up any remaining imports in tests or package code that still reference the deleted helpers.

**Step 3: Run engine tests**

Run:

- `bun test --cwd packages/tabletop-engine ./tests/types.test.ts`
- `bunx tsc -p packages/tabletop-engine/tsconfig.json --noEmit`

Expected: PASS.

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/types/state.ts packages/tabletop-engine/src/index.ts packages/tabletop-engine/tests/types.test.ts
git commit -m "refactor: remove canonical helper type exports"
```

### Task 5: Update docs that still describe the helper-based model

**Files:**

- Modify: `docs/design/2026-04-10-cli-artifact-generation-design.md`
- Modify: `docs/plans/2026-04-08-game-definition-validation-gap-implementation.md`

**Step 1: Update or remove stale references**

Remove or rewrite references that still present these as active public API:

- `CanonicalDataFromFacade`
- `CanonicalGameStateOf`
- `CanonicalStateOf`

Make the docs reflect the new simpler model:

- class property types drive local canonical inference
- `t(...)` remains runtime validation / schema / protocol truth

**Step 2: Run formatting/lint if needed**

Run: `bun run lint`

Expected: PASS.

**Step 3: Commit**

```bash
git add docs/design/2026-04-10-cli-artifact-generation-design.md docs/plans/2026-04-08-game-definition-validation-gap-implementation.md
git commit -m "docs: remove canonical helper guidance"
```

### Task 6: Run full verification

**Files:**

- No code changes expected

**Step 1: Run full verification**

Run:

```bash
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
bun test --cwd packages/cli
bun run lint
```

Expected:

- all commands PASS
- no remaining imports of the deleted helper types

**Step 2: Commit any final fixes**

If verification required any cleanup:

```bash
git add <files>
git commit -m "fix: finalize canonical inference cleanup"
```
