# Feedback 2: GameExecutor Naming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the vague consumer-facing `Kernel` / `createKernel(...)` naming with clearer reducer-style `GameExecutor` / `createGameExecutor(...)` naming.

**Architecture:** Rename the public runtime terminology while preserving the current stateless execution model. Keep backwards-compatible aliases initially so the migration can land safely and incrementally.

**Tech Stack:** TypeScript, Bun, existing `tabletop-kernel` runtime implementation, Bun test

---

### Task 1: Add failing tests for the new executor naming

**Files:**

- Modify: `packages/tabletop-kernel/tests/kernel-execution.test.ts`
- Modify: `packages/tabletop-kernel/tests/smoke.test.ts`

**Step 1: Write the failing tests**

Add tests that:

- import and call `createGameExecutor(...)`
- use the returned type name in at least one test-local annotation if useful
- verify the package root exports `createGameExecutor`

**Step 2: Run tests to verify they fail**

Run: `bun test --cwd packages/tabletop-kernel packages/tabletop-kernel/tests/kernel-execution.test.ts packages/tabletop-kernel/tests/smoke.test.ts`

Expected: FAIL because the new names do not exist yet.

### Task 2: Add the new executor names without breaking existing code

**Files:**

- Modify: `packages/tabletop-kernel/src/kernel/create-kernel.ts`
- Modify: `packages/tabletop-kernel/src/index.ts`

**Step 1: Rename the exported interface**

Rename or alias `Kernel` to `GameExecutor`.

**Step 2: Rename the factory**

Expose `createGameExecutor(...)` as the primary public name.

**Step 3: Keep compatibility**

Retain `createKernel(...)` as a compatibility alias for now so current consumers continue to work until later cleanup.

**Step 4: Update package exports**

Export the new names from the root index.

**Step 5: Run focused tests**

Run: `bun test --cwd packages/tabletop-kernel packages/tabletop-kernel/tests/kernel-execution.test.ts packages/tabletop-kernel/tests/smoke.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add packages/tabletop-kernel/src/kernel/create-kernel.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/kernel-execution.test.ts packages/tabletop-kernel/tests/smoke.test.ts
git commit -m "feat: add game executor naming"
```

### Task 3: Migrate internal consumers to the new naming

**Files:**

- Modify: `examples/splendor/tests/game.test.ts`
- Modify: `examples/splendor-terminal/src/session.ts`
- Modify: `packages/tabletop-kernel/tests/*.ts` as needed

**Step 1: Replace direct `createKernel(...)` usage where practical**

Update repo consumers to use `createGameExecutor(...)` so the new name becomes the visible default.

**Step 2: Run verification for touched areas**

Run:

- `bun test --cwd packages/tabletop-kernel`
- `bun test --cwd examples/splendor`
- `bun test --cwd examples/splendor-terminal`

Expected: PASS

**Step 3: Commit**

```bash
git add examples/splendor/tests/game.test.ts examples/splendor-terminal/src/session.ts packages/tabletop-kernel/tests
git commit -m "refactor: use game executor naming"
```

### Task 4: Run full verification and open PR

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

- `feedback-2-game-executor-naming`

**Step 3: Open PR against `main`**

PR title suggestion:

- `refactor: expose GameExecutor naming`

**Step 4: Stop for review**

Do not start feedback 5 until the user reviews the PR.
