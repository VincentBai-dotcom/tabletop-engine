# Feedback 1: GameDefinitionBuilder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `GameDefinitionBuilder` API so consumers can build game definitions through `new GameDefinitionBuilder(...).build()` instead of relying only on `defineGame(...)`.

**Architecture:** Keep the current `GameDefinition` plain-object core intact and add a builder façade on top of it. Implement the builder additively first, then migrate the Splendor example and a representative subset of tests to prove the new consumer experience.

**Tech Stack:** TypeScript, Bun, existing `tabletop-kernel` package structure, Bun test

---

### Task 1: Add failing tests for builder-based game definition authoring

**Files:**

- Modify: `packages/tabletop-kernel/tests/game-definition.test.ts`
- Modify: `packages/tabletop-kernel/tests/smoke.test.ts`

**Step 1: Write the failing tests**

Add tests that exercise:

- `new GameDefinitionBuilder("counter-game").initialState(...).commands(...).build()`
- exported package root includes `GameDefinitionBuilder`

The new test should assert the built definition matches the current plain-object structure used by `defineGame(...)`.

**Step 2: Run tests to verify they fail**

Run: `bun test --cwd packages/tabletop-kernel packages/tabletop-kernel/tests/game-definition.test.ts packages/tabletop-kernel/tests/smoke.test.ts`

Expected: FAIL because `GameDefinitionBuilder` does not exist yet.

**Step 3: Commit the red state is NOT required**

Do not commit failing tests alone. Move directly to implementation after confirming the failure.

### Task 2: Implement `GameDefinitionBuilder`

**Files:**

- Modify: `packages/tabletop-kernel/src/game-definition.ts`
- Modify: `packages/tabletop-kernel/src/index.ts`

**Step 1: Add builder types and class**

Add a `GameDefinitionBuilder` class that:

- takes `name` in the constructor
- stores partial definition data internally
- exposes chainable methods for:
  - `initialState(...)`
  - `commands(...)`
  - `progression(...)`
  - `rngSeed(...)`
  - `setup(...)`
- exposes `.build()` that returns the same `GameDefinition` shape used today

**Step 2: Keep `defineGame(...)` working**

Do not remove `defineGame(...)` yet. Implement the builder additively so current consumers do not break.

**Step 3: Export the new builder**

Export `GameDefinitionBuilder` from the package root.

**Step 4: Run focused tests**

Run: `bun test --cwd packages/tabletop-kernel packages/tabletop-kernel/tests/game-definition.test.ts packages/tabletop-kernel/tests/smoke.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/game-definition.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/game-definition.test.ts packages/tabletop-kernel/tests/smoke.test.ts
git commit -m "feat: add game definition builder"
```

### Task 3: Migrate the Splendor example to the builder API

**Files:**

- Modify: `examples/splendor/src/game.ts`

**Step 1: Replace `defineGame(...)` usage**

Update the Splendor example to use:

- `new GameDefinitionBuilder("splendor")`
- existing fields wired through builder methods
- `.build()`

Keep behavior identical.

**Step 2: Run focused Splendor tests**

Run: `bun test --cwd examples/splendor`

Expected: PASS

**Step 3: Commit**

```bash
git add examples/splendor/src/game.ts
git commit -m "refactor: use game definition builder in splendor"
```

### Task 4: Run full verification and open PR

**Files:**

- No code changes expected unless verification fails

**Step 1: Run full verification**

Run:

- `bun run lint`
- `bunx tsc -b`
- `bun test --cwd packages/tabletop-kernel`
- `bun test --cwd examples/splendor`
- `bun test --cwd examples/splendor-terminal`

Expected: all PASS

**Step 2: Push branch**

Use a dedicated branch, for example:

- `feedback-1-game-definition-builder`

**Step 3: Open PR against `main`**

PR title suggestion:

- `feat: add GameDefinitionBuilder`

**Step 4: Stop for review**

Do not start feedback 2 until the user reviews the PR.
