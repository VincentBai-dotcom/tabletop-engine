# Progression Lifecycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `tabletop-kernel` and the Splendor example so progression advancement becomes a kernel-managed lifecycle concern rather than a per-command manual responsibility.

**Architecture:** Keep progression lifecycle entirely in the core package. Add consumer-facing nested progression authoring with lifecycle fields on segment nodes, normalize internally, and introduce a kernel lifecycle resolution loop that runs after successful command execution. Keep completion policy read-only and lifecycle hooks mutation-capable. Update Splendor to use progression lifecycle rather than calling `finishTurn()` from every command.

**Tech Stack:** Bun workspace, TypeScript, Bun test runner, Markdown

---

### Task 1: Extend progression types for nested tree authoring

**Files:**

- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/types/progression.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/index.ts`
- Modify or create tests: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/types.test.ts`

**Step 1: Replace flat authoring assumptions**

Update progression definition types so the consumer-facing shape is a nested tree, not only a flat `segments` map.

Minimum node shape:

- required `id`
- required `children`
- optional `kind`
- optional `completionPolicy`
- optional `onEnter`
- optional `onExit`
- optional `resolveNext`

**Step 2: Define lifecycle callback and completion-policy types**

Add types for:

- built-in completion policy names
- completion callbacks
- lifecycle hook contexts
- progression resolution return values

Keep completion policy read-only and lifecycle hooks mutation-capable in the type model.

**Step 3: Export the new types**

Update the package barrel.

**Step 4: Verify**

Run:

- `bun run --cwd packages/tabletop-kernel typecheck`
- `bun test --cwd packages/tabletop-kernel tests/types.test.ts`

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/types/progression.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/types.test.ts
git commit -m "feat: add progression lifecycle type model"
```

### Task 2: Normalize nested progression definitions internally

**Files:**

- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/create-kernel.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/progression-normalize.ts`
- Create or modify tests: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/game-definition.test.ts`

**Step 1: Add normalization helper**

Implement a helper that converts the consumer-facing nested tree into an internal indexed representation.

The internal representation should at least preserve:

- node identity
- parent/child relationships
- optional `kind`
- lifecycle hooks
- completion policy
- current active segment pointer

**Step 2: Wire normalization into kernel initialization**

`createInitialState()` should initialize runtime progression from the normalized structure.

**Step 3: Verify**

Run:

- `bun run --cwd packages/tabletop-kernel typecheck`
- `bun test --cwd packages/tabletop-kernel tests/game-definition.test.ts`

**Step 4: Commit**

```bash
git add packages/tabletop-kernel/src/kernel/progression-normalize.ts packages/tabletop-kernel/src/kernel/create-kernel.ts packages/tabletop-kernel/tests/game-definition.test.ts
git commit -m "feat: normalize nested progression definitions"
```

### Task 3: Add lifecycle resolution contexts and built-in completion policies

**Files:**

- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/contexts.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/progression-lifecycle.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/types/command.ts`
- Modify or create tests: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/kernel-execution.test.ts`

**Step 1: Add lifecycle contexts**

Introduce contexts for:

- read-only completion-policy evaluation
- mutation-capable `onEnter` / `onExit`
- progression navigation helpers

Keep the boundary explicit:

- completion policy cannot mutate state
- lifecycle hooks can mutate `game` and emit events

**Step 2: Implement built-in completion policies**

Start with a small set:

- `after_successful_command`
- `manual_only`

Leave room for more later.

**Step 3: Verify**

Add focused tests for built-in policy evaluation behavior.

**Step 4: Commit**

```bash
git add packages/tabletop-kernel/src/kernel/progression-lifecycle.ts packages/tabletop-kernel/src/kernel/contexts.ts packages/tabletop-kernel/src/types/command.ts packages/tabletop-kernel/tests/kernel-execution.test.ts
git commit -m "feat: add progression lifecycle contexts"
```

### Task 4: Implement post-command lifecycle resolution loop

**Files:**

- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/create-kernel.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/events.ts`
- Modify or create tests: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/kernel-execution.test.ts`

**Step 1: Invoke lifecycle after successful command execution**

After `execute()` succeeds:

- evaluate completion policy for the current segment
- if complete, run `onExit`
- resolve next segment/owner
- update progression state
- run `onEnter`
- repeat until lifecycle reaches a stable point

**Step 2: Emit progression lifecycle events**

Chained progression changes should be represented as semantic events in the normal event stream.

Initial event set may include:

- `segment_exited`
- `segment_entered`

Keep names simple and stable.

**Step 3: Verify**

Add tests for:

- successful command triggers automatic lifecycle
- nested progression may emit multiple progression events
- manual-only segments do not auto-advance

**Step 4: Commit**

```bash
git add packages/tabletop-kernel/src/kernel/create-kernel.ts packages/tabletop-kernel/src/kernel/events.ts packages/tabletop-kernel/tests/kernel-execution.test.ts
git commit -m "feat: add progression lifecycle resolution loop"
```

### Task 5: Refactor Splendor progression to use lifecycle rules

**Files:**

- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/src/game.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/src/setup.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/src/model/game-ops.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/src/commands/*.ts`
- Modify tests: `/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/tests/game.test.ts`

**Step 1: Move turn lifecycle into progression**

For Splendor:

- current segment is `turn`
- completion policy is `after_successful_command`
- `onExit` should handle end-of-turn noble checks
- `resolveNext` should select the next player

**Step 2: Remove per-command `finishTurn()` responsibility**

Commands should no longer manually advance progression.

They should only:

- mutate game state
- emit domain events

**Step 3: Verify**

Run:

- `bun run --cwd examples/splendor typecheck`
- `bun test --cwd examples/splendor`

Add tests that specifically prove:

- commands no longer need explicit turn-finalization calls
- turn owner advances through progression lifecycle
- noble checks still happen correctly

**Step 4: Commit**

```bash
git add examples/splendor/src examples/splendor/tests/game.test.ts
git commit -m "refactor: move splendor turn logic into progression lifecycle"
```

### Task 6: Add manual progression example coverage

**Files:**

- Modify tests: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/kernel-execution.test.ts`

**Step 1: Add a minimal manual-only progression test**

Use a tiny fake game where:

- successful action commands do not auto-end the turn
- only an explicit `end_turn` command completes the segment

This verifies the optional-auto-progression direction.

**Step 2: Verify**

Run:

- `bun test --cwd packages/tabletop-kernel tests/kernel-execution.test.ts`

**Step 3: Commit**

```bash
git add packages/tabletop-kernel/tests/kernel-execution.test.ts
git commit -m "test: cover manual progression policy"
```

### Task 7: Final verification and docs touch-up

**Files:**

- Modify only if needed: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/README.md`
- Modify only if needed: `/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/README.md`

**Step 1: Full verification**

Run:

- `bun run lint`
- `bun run --cwd packages/tabletop-kernel typecheck`
- `bun test --cwd packages/tabletop-kernel`
- `bun run --cwd examples/splendor typecheck`
- `bun test --cwd examples/splendor`

**Step 2: Update readmes if the public authoring model changed materially**

Keep updates brief and high signal.

**Step 3: Commit**

```bash
git add packages/tabletop-kernel/README.md examples/splendor/README.md
git commit -m "docs: update lifecycle authoring notes"
```
