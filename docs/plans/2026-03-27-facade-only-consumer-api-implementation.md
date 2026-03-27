# Facade-Only Consumer API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change the public `tabletop-kernel` command and progression API to expose only facade state to consumers while keeping canonical state internal to the kernel.

**Architecture:** Split public and internal command/progression types. Public types become facade-only. Internal types continue to carry canonical state plus runtime state so the executor, replay, and snapshots keep their current behavior. Then migrate Splendor and tests off facade casts.

**Tech Stack:** TypeScript, Bun, existing state-facade hydration layer, kernel type system, Splendor example package.

---

### Task 1: Introduce internal canonical-plus-facade command context types

**Files:**

- Modify: `packages/tabletop-kernel/src/types/command.ts`
- Modify: `packages/tabletop-kernel/src/kernel/contexts.ts`
- Test: `packages/tabletop-kernel/tests/types.test.ts`

**Step 1: Write the failing test**

Add type-level assertions showing:

- public `CommandDefinition<TFacadeState, ...>` exposes facade-only `game`
- internal command definition/context types still expose canonical state and runtime

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/types.test.ts`
Expected: FAIL because public and internal command types are still conflated

**Step 3: Write minimal implementation**

Implement:

- public facade-only command contexts/types
- internal canonical-aware command contexts/types
- context builders in `kernel/contexts.ts` returning the internal variants

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/types/command.ts packages/tabletop-kernel/src/kernel/contexts.ts packages/tabletop-kernel/tests/types.test.ts
git commit -m "refactor: split public and internal command contexts"
```

### Task 2: Make public progression types facade-only

**Files:**

- Modify: `packages/tabletop-kernel/src/types/progression.ts`
- Modify: `packages/tabletop-kernel/src/kernel/contexts.ts`
- Test: `packages/tabletop-kernel/tests/types.test.ts`
- Test: `packages/tabletop-kernel/tests/kernel-execution.test.ts`

**Step 1: Write the failing test**

Add type-level assertions showing:

- public progression hook contexts expose facade-only `game`
- internal progression contexts still support canonical/runtime state

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/types.test.ts tests/kernel-execution.test.ts`
Expected: FAIL because progression public types still carry canonical generic expectations

**Step 3: Write minimal implementation**

Implement:

- public facade-only progression contexts/types
- internal canonical-aware progression types kept for normalization/executor
- update context factories and progression lifecycle plumbing as needed

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/types.test.ts tests/kernel-execution.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/types/progression.ts packages/tabletop-kernel/src/kernel/contexts.ts packages/tabletop-kernel/tests/types.test.ts packages/tabletop-kernel/tests/kernel-execution.test.ts
git commit -m "refactor: split public and internal progression contexts"
```

### Task 3: Thread facade type through game definitions internally

**Files:**

- Modify: `packages/tabletop-kernel/src/game-definition.ts`
- Modify: `packages/tabletop-kernel/src/kernel/create-kernel.ts`
- Modify: `packages/tabletop-kernel/src/kernel/progression-normalize.ts`
- Test: `packages/tabletop-kernel/tests/game-definition.test.ts`
- Test: `packages/tabletop-kernel/tests/kernel-execution.test.ts`

**Step 1: Write the failing test**

Add tests that require:

- game definitions to preserve canonical state internally
- commands/progression definitions to be accepted when authored against the
  facade type

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/game-definition.test.ts tests/kernel-execution.test.ts`
Expected: FAIL because builder/game definition generics still assume one public game-state type

**Step 3: Write minimal implementation**

Implement the internal split so:

- `GameDefinitionBuilder<TCanonicalState>` remains the public entry point
- `.rootState(...)` captures the facade type
- internal game definition/executor types carry both canonical and facade state

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/game-definition.test.ts tests/kernel-execution.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/game-definition.ts packages/tabletop-kernel/src/kernel/create-kernel.ts packages/tabletop-kernel/src/kernel/progression-normalize.ts packages/tabletop-kernel/tests/game-definition.test.ts packages/tabletop-kernel/tests/kernel-execution.test.ts
git commit -m "refactor: thread facade types through game definitions"
```

### Task 4: Remove Splendor facade casts

**Files:**

- Modify: `examples/splendor/src/commands/shared.ts`
- Modify: `examples/splendor/src/commands/*.ts`
- Modify: `examples/splendor/src/commands/index.ts`
- Modify: `examples/splendor/src/game.ts`
- Modify: `examples/splendor/src/state.ts`
- Test: `examples/splendor/tests/game.test.ts`

**Step 1: Write the failing test**

Add or update tests so Splendor command/progression typing compiles without
`getSplendorGameFacade(...)` or facade casts.

**Step 2: Run test to verify it fails**

Run: `bun run --cwd examples/splendor typecheck`
Expected: FAIL until command/progression types are migrated

**Step 3: Write minimal implementation**

Migrate Splendor so:

- command definitions are typed against `SplendorGameStateFacade`
- progression hooks are typed against `SplendorGameStateFacade`
- `getSplendorGameFacade(...)` is removed
- `asSplendorGameFacade(...)` is no longer needed in command/progression code

**Step 4: Run test to verify it passes**

Run:

```bash
bun run --cwd examples/splendor typecheck
bun test --cwd examples/splendor
```

Expected: PASS

**Step 5: Commit**

```bash
git add examples/splendor/src/commands/shared.ts examples/splendor/src/commands examples/splendor/src/game.ts examples/splendor/src/state.ts examples/splendor/tests/game.test.ts
git commit -m "refactor: remove splendor facade casts"
```

### Task 5: Final verification and docs update

**Files:**

- Modify: `packages/tabletop-kernel/README.md`
- Modify: `docs/design/2026-03-25-state-facade-authoring-design.md`
- Modify: `docs/design/2026-03-27-facade-only-consumer-api-design.md`

**Step 1: Update docs**

Document:

- public consumer APIs are facade-only
- canonical state remains internal to the kernel
- command/progression authoring examples no longer require casts

**Step 2: Run full verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-kernel
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected: all pass

**Step 3: Commit**

```bash
git add packages/tabletop-kernel/README.md docs/design/2026-03-25-state-facade-authoring-design.md docs/design/2026-03-27-facade-only-consumer-api-design.md
git commit -m "docs: describe facade-only consumer api"
```
