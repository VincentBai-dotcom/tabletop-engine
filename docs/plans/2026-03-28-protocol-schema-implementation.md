# Protocol Schema Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add colocated runtime schema metadata for command payloads and custom visible views, then expose a first `describeGameProtocol(...)` API that validates and reads that metadata from a built `GameDefinition`.

**Architecture:** Extend the new TypeBox-backed `t` system into the command and custom-view authoring APIs. Commands should declare `payloadSchema` on the command object, and states using `projectCustomView(...)` should declare a colocated `@viewSchema(...)`. After those metadata sources exist, add a transport-agnostic `describeGameProtocol(...)` API that extracts command and view schema metadata and fails fast when required metadata is missing.

**Tech Stack:** TypeScript, Bun, TypeBox, existing `t` schema module, state-facade decorators, Bun tests

---

### Task 1: Lock protocol-schema expectations with failing tests

**Files:**

- Create: `packages/tabletop-kernel/tests/protocol.test.ts`
- Modify: `packages/tabletop-kernel/tests/types.test.ts`

**Step 1: Write the failing tests**

Add tests that assert:

- a command definition exposes a required `payloadSchema`
- `CommandDefinition<TGame, typeof schema>` makes `commandInput.payload` match the schema shape
- `describeGameProtocol(gameDefinition)` returns command schema metadata for commands that provide `payloadSchema`
- `describeGameProtocol(gameDefinition)` fails if a command is missing `payloadSchema`
- `describeGameProtocol(gameDefinition)` fails if a state has `projectCustomView(...)` without a `@viewSchema(...)`

Keep the first tests small and use synthetic game/state/command fixtures rather than Splendor.

**Step 2: Run tests to verify they fail**

Run:

```bash
bun test --cwd packages/tabletop-kernel tests/protocol.test.ts
bun test --cwd packages/tabletop-kernel tests/types.test.ts
```

Expected: failures for missing protocol API, missing `payloadSchema` support, or missing `@viewSchema(...)`.

**Step 3: Commit**

```bash
git add packages/tabletop-kernel/tests/protocol.test.ts packages/tabletop-kernel/tests/types.test.ts
git commit -m "test: add protocol schema coverage"
```

### Task 2: Add serializable schema typing helpers

**Files:**

- Modify: `packages/tabletop-kernel/src/schema/types.ts`
- Modify: `packages/tabletop-kernel/src/schema/index.ts`
- Modify: `packages/tabletop-kernel/src/index.ts`
- Test: `packages/tabletop-kernel/tests/types.test.ts`

**Step 1: Add schema-level helper types**

Introduce the minimum type helpers needed for command and view schemas:

- a serializable schema type alias
- an inferred static type helper based on TypeBox

Keep `t.state(...)` excluded from the serializable schema type.

**Step 2: Run focused type tests**

Run:

```bash
bun test --cwd packages/tabletop-kernel tests/types.test.ts
bunx tsc -b
```

Expected: schema helper type tests pass.

**Step 3: Commit**

```bash
git add packages/tabletop-kernel/src/schema/types.ts packages/tabletop-kernel/src/schema/index.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/types.test.ts
git commit -m "feat: add serializable schema helper types"
```

### Task 3: Add `payloadSchema` to command authoring

**Files:**

- Modify: `packages/tabletop-kernel/src/types/command.ts`
- Modify: `packages/tabletop-kernel/src/game-definition.ts`
- Modify: `packages/tabletop-kernel/src/kernel/create-kernel.ts`
- Test: `packages/tabletop-kernel/tests/protocol.test.ts`
- Test: `packages/tabletop-kernel/tests/types.test.ts`

**Step 1: Implement command-schema typing**

Change command authoring so:

- `CommandDefinition` takes a schema type generic instead of a pre-built `CommandInput` type
- `commandInput.payload` is inferred from the schema
- `payloadSchema` is required on public and internal command definitions

Keep runtime execution behavior unchanged.

**Step 2: Add build-time validation for command schema presence where appropriate**

At minimum, `describeGameProtocol(...)` must be able to rely on `payloadSchema`.
If ordinary build-time enforcement is too disruptive, keep strict failure at protocol-descriptor generation time.

**Step 3: Run tests**

Run:

```bash
bun test --cwd packages/tabletop-kernel tests/protocol.test.ts
bun test --cwd packages/tabletop-kernel tests/types.test.ts
bunx tsc -b
```

Expected: command-schema tests pass.

**Step 4: Commit**

```bash
git add packages/tabletop-kernel/src/types/command.ts packages/tabletop-kernel/src/game-definition.ts packages/tabletop-kernel/src/kernel/create-kernel.ts packages/tabletop-kernel/tests/protocol.test.ts packages/tabletop-kernel/tests/types.test.ts
git commit -m "feat: add command payload schemas"
```

### Task 4: Migrate Splendor commands to `payloadSchema`

**Files:**

- Modify: `examples/splendor/src/commands/*.ts`
- Modify: `examples/splendor/src/commands/shared.ts`
- Modify: `examples/splendor/src/state.ts` as needed
- Test: `examples/splendor/tests/game.test.ts`

**Step 1: Add concrete payload schemas to each Splendor command**

For each command:

- define a colocated payload schema
- assign it to `payloadSchema`
- update command typing to use the schema type

Reduce redundant payload type declarations where the schema can become the source of truth cleanly.

**Step 2: Remove obsolete payload helpers only if no longer needed**

Do not over-refactor. Keep helper cleanup minimal and only when directly enabled by the new schema typing.

**Step 3: Run example verification**

Run:

```bash
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected: both pass.

**Step 4: Commit**

```bash
git add examples/splendor/src/commands examples/splendor/src/state.ts
git commit -m "refactor: migrate splendor command payload schemas"
```

### Task 5: Add `@viewSchema(...)` for custom visible views

**Files:**

- Modify: `packages/tabletop-kernel/src/state-facade/metadata.ts`
- Modify: `packages/tabletop-kernel/src/state-facade/project.ts`
- Test: `packages/tabletop-kernel/tests/protocol.test.ts`
- Test: `packages/tabletop-kernel/tests/kernel-execution.test.ts`

**Step 1: Write the failing tests**

Cover:

- a state with `projectCustomView(...)` can attach `@viewSchema(...)`
- protocol generation can read that schema
- protocol generation fails if the method exists without `@viewSchema(...)`
- protocol generation fails if `@viewSchema(...)` exists without the method

Do not change runtime visibility behavior yet except whatever metadata plumbing is required.

**Step 2: Implement metadata support**

Add method-level schema metadata for `projectCustomView(...)`.

Keep the runtime hook behavior unchanged.

**Step 3: Run tests**

Run:

```bash
bun test --cwd packages/tabletop-kernel tests/protocol.test.ts
bun test --cwd packages/tabletop-kernel tests/kernel-execution.test.ts
```

Expected: custom-view schema tests pass.

**Step 4: Commit**

```bash
git add packages/tabletop-kernel/src/state-facade/metadata.ts packages/tabletop-kernel/src/state-facade/project.ts packages/tabletop-kernel/tests/protocol.test.ts packages/tabletop-kernel/tests/kernel-execution.test.ts
git commit -m "feat: add custom view schemas"
```

### Task 6: Add the first `describeGameProtocol(...)`

**Files:**

- Create: `packages/tabletop-kernel/src/protocol/describe.ts`
- Modify: `packages/tabletop-kernel/src/index.ts`
- Test: `packages/tabletop-kernel/tests/protocol.test.ts`

**Step 1: Implement the protocol descriptor shape**

Add a minimal transport-agnostic descriptor containing:

- game name
- command ids
- command payload schemas
- visible root schema information
- enough metadata to know whether a custom view schema was used

Keep AsyncAPI generation out of this step.

**Step 2: Enforce completeness**

`describeGameProtocol(gameDefinition)` should fail fast if:

- a command lacks `payloadSchema`
- `projectCustomView(...)` exists without `@viewSchema(...)`
- `@viewSchema(...)` exists without `projectCustomView(...)`

**Step 3: Run tests**

Run:

```bash
bun test --cwd packages/tabletop-kernel tests/protocol.test.ts
bunx tsc -b
```

Expected: protocol tests pass.

**Step 4: Commit**

```bash
git add packages/tabletop-kernel/src/protocol/describe.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/protocol.test.ts
git commit -m "feat: describe game protocol schemas"
```

### Task 7: Full verification

**Files:**

- No code changes expected unless verification finds issues

**Step 1: Run the full verification suite**

Run:

```bash
bunx tsc -b
bun run lint
bun test --cwd packages/tabletop-kernel
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected: all pass.

**Step 2: Commit follow-up fixes if needed**

If verification finds issues, fix them in one small focused commit.

**Step 3: Stop**

Do not start AsyncAPI document generation itself in the same batch unless explicitly requested after the protocol descriptor is in place.
