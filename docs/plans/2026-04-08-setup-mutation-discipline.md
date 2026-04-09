# Setup Mutation Discipline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the setup-only direct mutation escape hatch so `setup()` follows the same facade mutation discipline as normal game execution.

**Architecture:** The engine should stop hydrating setup facades with elevated direct-write permissions. Setup code must instead call explicit methods on state facades, just like command execution. This requires removing `allowDirectMutation` from hydration/runtime code and updating setup callsites in tests and Splendor to mutate through state methods.

**Tech Stack:** TypeScript, Bun, tabletop-engine state facade runtime

---

### Task 1: Remove the hydrator escape hatch

**Files:**

- Modify: `packages/tabletop-engine/src/state-facade/hydrate.ts`
- Modify: `packages/tabletop-engine/src/runtime/game-executor.ts`

**Steps:**

1. Remove the `allowDirectMutation` option from state hydration APIs.
2. Restore the default mutation context to require method-owned mutation depth.
3. Update `createInitialState()` so `setup()` receives a normal writable facade instead of a direct-write facade.

### Task 2: Convert setup callsites to method-based mutation

**Files:**

- Modify: `packages/tabletop-engine/tests/game-execution.test.ts`
- Modify: `examples/splendor/src/states/game-state.ts`
- Modify: `examples/splendor/src/states/board-state.ts`
- Modify: `examples/splendor/src/states/player-state.ts`
- Modify: `examples/splendor/src/setup.ts`

**Steps:**

1. Add small setup-oriented methods to the test state facades that currently rely on raw assignment.
2. Rewrite test `setup()` blocks to call those methods instead of assigning fields.
3. Add explicit initialization methods to Splendor state classes for setup-owned mutations.
4. Rewrite `setupSplendorGame(...)` to use those methods only.

### Task 3: Verify behavior and commit

**Files:**

- Verify only

**Steps:**

1. Run `bun run lint`.
2. Run `bunx tsc -b`.
3. Run `bun test --cwd packages/tabletop-engine`.
4. Run `bun test --cwd examples/splendor`.
5. Run `bun test --cwd examples/splendor-terminal`.
6. Commit with a focused message once all checks pass.
