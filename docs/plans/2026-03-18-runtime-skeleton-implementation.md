# Tabletop-Kernel Runtime Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the repo into a Bun workspace and implement the first compile-able `tabletop-kernel` package with a transactional command runtime skeleton, deterministic RNG skeleton, snapshot/replay interfaces, and a small scenario-style test harness.

**Architecture:** Use a root Bun workspace and a single publishable package at `packages/tabletop-kernel`. Keep the public API small and type-driven. Implement only the minimum runtime loop needed to validate commands, execute against a transactional working state, collect semantic events, and commit atomically. Defer the Splendor example package until the real rulebook and card data arrive.

**Tech Stack:** Bun workspace, TypeScript, Bun test runner, Markdown

---

### Task 1: Bootstrap the Bun workspace

**Files:**
- Create or modify: `/home/vincent-bai/Documents/github/tabletop-kernel/package.json`
- Create or modify: `/home/vincent-bai/Documents/github/tabletop-kernel/tsconfig.json`
- Create or modify: `/home/vincent-bai/Documents/github/tabletop-kernel/README.md`
- Create if generated: `/home/vincent-bai/Documents/github/tabletop-kernel/.gitignore`
- Create if generated: `/home/vincent-bai/Documents/github/tabletop-kernel/CLAUDE.md`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/bunfig.toml`

**Step 1: Scaffold the root with Bun**

Run: `bun init -y`
Expected: Bun creates or updates the root project files non-destructively.

**Step 2: Convert the root package into a workspace root**

Modify `package.json` to:
- mark the root as private
- add workspace entries for `packages/*`
- add root scripts for `typecheck`, `test`, and package-scoped commands

**Step 3: Add Bun workspace configuration**

Create `bunfig.toml` only if needed for workspace-level defaults. Keep it minimal.

**Step 4: Verify the root scaffolding**

Run: `sed -n '1,220p' package.json`
Expected: root manifest shows Bun workspace configuration instead of a standalone app package.

**Step 5: Commit**

```bash
git add package.json tsconfig.json README.md .gitignore CLAUDE.md bunfig.toml
git commit -m "build: bootstrap bun workspace root"
```

### Task 2: Create the kernel package shell

**Files:**
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/package.json`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tsconfig.json`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/README.md`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/index.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/smoke.test.ts`

**Step 1: Scaffold the package with Bun**

Run: `mkdir -p packages/tabletop-kernel && bun init -y --cwd packages/tabletop-kernel`
Expected: Bun creates a minimal package scaffold inside `packages/tabletop-kernel`.

**Step 2: Convert the generated package into a publishable library package**

Modify `packages/tabletop-kernel/package.json` to:
- set the package name to `tabletop-kernel`
- define `exports`
- define `types`
- add `test` and `typecheck` scripts
- remove app-style assumptions from the generated manifest

**Step 3: Replace the generated entry point with a package barrel**

Implement `src/index.ts` as the public export surface for the kernel skeleton.

**Step 4: Add a smoke test**

Create `tests/smoke.test.ts` that imports the package root and verifies the package can be loaded.

**Step 5: Verify the package shell**

Run: `bun test packages/tabletop-kernel/tests/smoke.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/tabletop-kernel
git commit -m "build: scaffold tabletop-kernel package"
```

### Task 3: Add foundational runtime types

**Files:**
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/types/state.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/types/command.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/types/event.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/types/result.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/types/progression.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/types/rng.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/types/snapshot.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/index.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/types.test.ts`

**Step 1: Define canonical state types**

Add `{ game, runtime }` types, with runtime sections kept minimal and explicitly provisional.

**Step 2: Define command contracts**

Add:
- plain command data type
- `ValidationResult`
- command definition type with required `validate` and `execute`
- read-only validation context and richer execute context types

**Step 3: Define event and execution-result contracts**

Add:
- unified semantic event type with `category` and `type`
- success/failure result object shapes
- failure contract that still includes `state`

**Step 4: Define progression, RNG, and snapshot/replay interface types**

Keep them skeletal but aligned with the approved design docs.

**Step 5: Export the types from the package barrel**

Update `src/index.ts` accordingly.

**Step 6: Write a type-level smoke test**

Use a small test to instantiate the public types in a minimal example and confirm the package surface is coherent.

**Step 7: Verify**

Run: `bun test packages/tabletop-kernel/tests/types.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/tabletop-kernel/src packages/tabletop-kernel/tests/types.test.ts
git commit -m "feat: add foundational kernel types"
```

### Task 4: Implement game-definition registration APIs

**Files:**
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/game-definition.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/index.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/game-definition.test.ts`

**Step 1: Add `defineGame`**

Implement a lightweight helper that accepts:
- game name
- initial state factory
- command definitions
- optional progression description
- optional RNG seed

It should mostly normalize and return the supplied configuration.

**Step 2: Add the public game-definition types**

Make the shape easy to consume from example games later.

**Step 3: Test the registration path**

Write a test that defines a tiny fake game and checks that command definitions and initial-state setup are preserved.

**Step 4: Verify**

Run: `bun test packages/tabletop-kernel/tests/game-definition.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/game-definition.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/game-definition.test.ts
git commit -m "feat: add game definition registration"
```

### Task 5: Implement the transactional command runtime skeleton

**Files:**
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/create-kernel.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/transaction.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/contexts.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/events.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/index.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/kernel-execution.test.ts`

**Step 1: Add a transactional working-state helper**

Implement a small transaction helper that:
- clones the input canonical state
- exposes the draft to `execute`
- returns either the committed next state or the original state unchanged

Keep the implementation simple for v1. A straightforward clone-based transaction is acceptable initially.

**Step 2: Add validation and execute contexts**

Validation context:
- canonical read access
- actor / command metadata
- progression read access

Execute context:
- mutable draft `game`
- read access to runtime
- ordered semantic event collection

**Step 3: Implement `createKernel`**

Add a kernel object with:
- `createInitialState()`
- `executeCommand(state, command, options?)`

`executeCommand` should:
- resolve the command definition
- run `validate`
- return failure with unchanged state when validation fails
- run `execute` against a transaction when validation succeeds
- collect emitted semantic events
- commit atomically on success

**Step 4: Add a runtime execution test**

Use a tiny fake command like `increment_counter` to verify:
- successful execution mutates committed state
- validation failure returns unchanged state
- emitted events are included in the result

**Step 5: Verify**

Run: `bun test packages/tabletop-kernel/tests/kernel-execution.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/tabletop-kernel/src/kernel packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/kernel-execution.test.ts
git commit -m "feat: add transactional command execution skeleton"
```

### Task 6: Add the deterministic RNG skeleton

**Files:**
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/rng/service.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/rng/prng.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/contexts.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/index.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/rng.test.ts`

**Step 1: Add a persisted RNG state shape**

Store the RNG seed/state inside runtime in a minimal form.

**Step 2: Implement basic RNG primitives**

Implement only:
- `number()`
- `die(sides, count?)`
- `shuffle(array)`

They should update RNG state deterministically.

**Step 3: Expose RNG to execute context**

Make the kernel RNG the only randomness surface exposed in normal execution.

**Step 4: Test deterministic behavior**

Write tests showing:
- same seed + same commands => same outputs
- RNG state advances when consumed

**Step 5: Verify**

Run: `bun test packages/tabletop-kernel/tests/rng.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/tabletop-kernel/src/rng packages/tabletop-kernel/src/kernel/contexts.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/rng.test.ts
git commit -m "feat: add deterministic rng skeleton"
```

### Task 7: Add snapshot and replay skeletons

**Files:**
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/replay/history.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/snapshot/snapshot.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/kernel/create-kernel.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/index.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/replay.test.ts`

**Step 1: Add snapshot helpers**

Implement small helpers for:
- taking a full canonical snapshot
- restoring from a snapshot shape

**Step 2: Add replay-record helpers**

Track minimal replay artifacts:
- command inputs
- optional checkpoints
- emitted events

Keep the format intentionally internal-first.

**Step 3: Thread replay artifacts through command execution**

Return enough structured data from `executeCommand` to support later replay/history expansion.

**Step 4: Test a tiny replay cycle**

Use a toy game and verify that a short command sequence from the same seed yields the same resulting state.

**Step 5: Verify**

Run: `bun test packages/tabletop-kernel/tests/replay.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/tabletop-kernel/src/replay packages/tabletop-kernel/src/snapshot packages/tabletop-kernel/src/kernel/create-kernel.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/replay.test.ts
git commit -m "feat: add snapshot and replay skeletons"
```

### Task 8: Add the scenario-style test harness skeleton

**Files:**
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/testing/harness.ts`
- Modify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/index.ts`
- Create: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/tests/harness.test.ts`

**Step 1: Implement a tiny scenario runner**

Add a helper that:
- starts from initial state
- applies a list of commands
- returns final state plus per-command results

**Step 2: Expose the harness**

Export it as a consumer-facing testing utility.

**Step 3: Test a full mini-scenario**

Use the toy counter game to verify that multi-command scenarios are easy to express in tests.

**Step 4: Verify**

Run: `bun test packages/tabletop-kernel/tests/harness.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/testing packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/harness.test.ts
git commit -m "feat: add scenario test harness skeleton"
```

### Task 9: Run package-level verification and document deferrals

**Files:**
- Modify if needed: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/README.md`
- Verify: `/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-kernel/src/`

**Step 1: Run all kernel tests**

Run: `bun test --cwd packages/tabletop-kernel`
Expected: all kernel tests pass

**Step 2: Run package typecheck**

Run: `bun run --cwd packages/tabletop-kernel typecheck`
Expected: no TypeScript errors

**Step 3: Document the current boundary**

Update the package README to say explicitly that:
- Splendor is deferred pending real materials
- visibility and first-class internal steps are deferred
- the current runtime is a skeleton, not the final API

**Step 4: Commit**

```bash
git add packages/tabletop-kernel/README.md packages/tabletop-kernel/src packages/tabletop-kernel/tests
git commit -m "docs: describe runtime skeleton boundary"
```

