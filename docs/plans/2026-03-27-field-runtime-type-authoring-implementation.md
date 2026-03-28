# Field Runtime Type Authoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current per-field state decorators with a single `@field(...)` decorator backed by a composable runtime type builder `t`, while preserving the current canonical-state and `GameExecutor` model.

**Architecture:** Keep `@State()` as the class marker, introduce a kernel-owned runtime field type system, and update the state-facade metadata/compiler/hydrator to consume the new field metadata. Land the change incrementally, preserving temporary compatibility until Splendor and the tests are migrated.

**Tech Stack:** TypeScript, Bun, existing `tabletop-kernel` state-facade system, Bun test suite.

---

### Task 1: Add runtime field type primitives

**Files:**

- Modify: `packages/tabletop-kernel/src/state-facade/metadata.ts`
- Modify: `packages/tabletop-kernel/src/index.ts`
- Test: `packages/tabletop-kernel/tests/state-facade.test.ts`

**Step 1: Write the failing test**

Add tests that define a decorated state class using:

```ts
@State()
class PlayerState {
  @field(t.number())
  health!: number;

  @field(t.state(() => HandState))
  hand!: HandState;
}
```

and expect the metadata layer to expose runtime field type objects for both
primitive and nested state fields.

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/state-facade.test.ts`
Expected: FAIL because `field(...)` and `t` do not exist

**Step 3: Write minimal implementation**

Implement:

- `field(...)`
- `t.number()`
- `t.string()`
- `t.boolean()`
- `t.state(() => NestedState)`
- `t.array(itemType)`
- `t.record(keyType, valueType)`

Keep `@scalar()` and `@state(...)` working temporarily by translating them into
the new runtime field type metadata internally.

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/state-facade.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/state-facade/metadata.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/state-facade.test.ts
git commit -m "feat: add runtime field type builder"
```

### Task 2: Compile runtime field types into facade metadata

**Files:**

- Modify: `packages/tabletop-kernel/src/state-facade/compile.ts`
- Test: `packages/tabletop-kernel/tests/game-definition.test.ts`
- Test: `packages/tabletop-kernel/tests/state-facade.test.ts`

**Step 1: Write the failing test**

Add tests that build a root state with:

- primitive fields
- nested state fields
- arrays of nested state

and expect the compiled metadata to retain the runtime field type structure.

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/game-definition.test.ts tests/state-facade.test.ts`
Expected: FAIL because compile only understands the old scalar/state split

**Step 3: Write minimal implementation**

Update compilation so it:

- stores runtime field type definitions
- recursively visits nested `t.state(...)` references
- recursively visits nested state references inside `t.array(...)` and `t.record(...)`
- keeps rejecting undecorated nested state targets

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/game-definition.test.ts tests/state-facade.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/state-facade/compile.ts packages/tabletop-kernel/tests/game-definition.test.ts packages/tabletop-kernel/tests/state-facade.test.ts
git commit -m "feat: compile runtime field types"
```

### Task 3: Hydrate fields from runtime field type metadata

**Files:**

- Modify: `packages/tabletop-kernel/src/state-facade/hydrate.ts`
- Test: `packages/tabletop-kernel/tests/state-facade.test.ts`
- Test: `packages/tabletop-kernel/tests/kernel-execution.test.ts`

**Step 1: Write the failing test**

Add tests that execute commands against a state facade containing:

- primitive fields via `@field(t.number())`
- nested state fields via `@field(t.state(...))`
- nested state arrays via `@field(t.array(t.state(...)))`

and expect hydration to lazily expose the correct facade objects.

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/state-facade.test.ts tests/kernel-execution.test.ts`
Expected: FAIL because hydrator only understands the old field metadata model

**Step 3: Write minimal implementation**

Update hydration so it:

- treats primitive runtime types as plain/scalar fields
- lazily hydrates nested `t.state(...)` fields
- lazily hydrates arrays/records whose item/value type is `t.state(...)`
- preserves readonly and direct-mutation guard behavior

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/state-facade.test.ts tests/kernel-execution.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/state-facade/hydrate.ts packages/tabletop-kernel/tests/state-facade.test.ts packages/tabletop-kernel/tests/kernel-execution.test.ts
git commit -m "feat: hydrate facades from runtime field types"
```

### Task 4: Port Splendor state classes to `@field(t...)`

**Files:**

- Modify: `examples/splendor/src/state.ts`
- Test: `examples/splendor/tests/game.test.ts`

**Step 1: Write the failing test**

Update the existing root-state facade test to assert that Splendor uses
`@field(t...)` metadata instead of the older field decorators.

**Step 2: Run test to verify it fails**

Run: `bun test --cwd examples/splendor tests/game.test.ts`
Expected: FAIL because Splendor still uses `@scalar()` / `@state(...)`

**Step 3: Write minimal implementation**

Port the Splendor facade classes to:

- `@field(t.number())`
- `@field(t.state(...))`
- `@field(t.array(...))`
- `@field(t.record(...))` where appropriate

Do not change the canonical state shape or command behavior.

**Step 4: Run test to verify it passes**

Run: `bun test --cwd examples/splendor tests/game.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add examples/splendor/src/state.ts examples/splendor/tests/game.test.ts
git commit -m "refactor: migrate splendor field metadata"
```

### Task 5: Remove legacy field decorators

**Files:**

- Modify: `packages/tabletop-kernel/src/state-facade/metadata.ts`
- Modify: `packages/tabletop-kernel/src/index.ts`
- Test: `packages/tabletop-kernel/tests/state-facade.test.ts`
- Test: `examples/splendor/tests/game.test.ts`

**Step 1: Write the failing test**

Remove the last in-repo uses of `@scalar()` and `@state(...)` and update tests
to assert that `@field(t...)` is the only supported field-authoring API.

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/state-facade.test.ts && bun test --cwd examples/splendor tests/game.test.ts`
Expected: FAIL until the old exports and compatibility paths are removed

**Step 3: Write minimal implementation**

Remove:

- `@scalar()`
- `@state(...)`

and keep only:

- `@State()`
- `@field(...)`
- `t`

**Step 4: Run test to verify it passes**

Run:

```bash
bun test --cwd packages/tabletop-kernel tests/state-facade.test.ts
bun test --cwd examples/splendor tests/game.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/state-facade/metadata.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/state-facade.test.ts examples/splendor/tests/game.test.ts
git commit -m "refactor: remove legacy field decorators"
```

### Task 6: Final verification

**Files:**

- Modify: `packages/tabletop-kernel/README.md`
- Modify: `examples/splendor/README.md`

**Step 1: Update docs**

Document:

- `@State()`
- `@field(...)`
- `t`
- examples of nested state and collections

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
git add packages/tabletop-kernel/README.md examples/splendor/README.md
git commit -m "docs: describe runtime field type authoring"
```
