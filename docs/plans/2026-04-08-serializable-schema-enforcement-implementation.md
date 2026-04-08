# Serializable Schema Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent `t.state(...)` from being used in transport-facing schema surfaces and fail fast with a clear error when it appears in command input schemas, discovery schemas, hidden-summary schemas, or custom view schemas.

**Architecture:** Introduce a recursive serializable schema type that excludes `NestedStateFieldType`, then use it across all transport/view schema authoring APIs. Add runtime validation in schema composition so nested `t.state(...)` throws an explicit error instead of silently degrading into `Type.Unknown()`.

**Tech Stack:** TypeScript, Bun tests, TypeBox-backed `t` schema helpers, command factory typing, state-facade metadata, protocol description.

---

### Task 1: Lock enforcement behavior in tests

**Files:**

- Modify: `packages/tabletop-engine/tests/schema.test.ts`
- Modify: `packages/tabletop-engine/tests/types.test.ts`
- Modify: `packages/tabletop-engine/tests/protocol.test.ts`

**Step 1: Add failing runtime tests**

Add tests that assert these throw explicit errors:

- `t.object({ child: t.state(...) })`
- `t.array(t.state(...))`
- `t.optional(t.state(...))`
- `t.record(t.string(), t.state(...))`

Also add coverage that `@hidden({ schema })` and `@viewSchema(...)` reject nested `t.state(...)` through those builders.

**Step 2: Add failing type-level tests**

Add type assertions showing these are no longer valid:

- `CommandSchema.schema` using a schema tree that includes `t.state(...)`
- `discoverySchema` using a schema tree that includes `t.state(...)`
- `@hidden({ schema })` using a schema tree that includes `t.state(...)`
- `@visibleToSelf({ schema })` using a schema tree that includes `t.state(...)`
- `@viewSchema(...)` using a schema tree that includes `t.state(...)`

**Step 3: Run targeted tests to verify red**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/schema.test.ts tests/types.test.ts tests/protocol.test.ts
```

Expected:

- FAIL because nested `t.state(...)` currently still composes inside transport-facing schemas

**Step 4: Commit**

```bash
git add packages/tabletop-engine/tests/schema.test.ts packages/tabletop-engine/tests/types.test.ts packages/tabletop-engine/tests/protocol.test.ts docs/plans/2026-04-08-serializable-schema-enforcement-implementation.md
git commit -m "test: lock serializable schema enforcement"
```

### Task 2: Add recursive serializable schema typing

**Files:**

- Modify: `packages/tabletop-engine/src/schema/types.ts`
- Modify: `packages/tabletop-engine/src/schema/index.ts`
- Modify: `packages/tabletop-engine/src/index.ts`

**Step 1: Introduce recursive serializable field types**

Define recursive transport-safe schema types that exclude `NestedStateFieldType`, for example:

- serializable primitive
- serializable object
- serializable array
- serializable record
- serializable optional

Keep canonical `FieldType` unchanged for `@field(t.state(...))`.

**Step 2: Update builder generics**

Tighten the `t` composition helpers so serializable composition paths can preserve recursive exclusions instead of widening back to general `FieldType`.

**Step 3: Run targeted type tests**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/types.test.ts tests/schema.test.ts
```

Expected:

- type-level negative assertions now compile correctly

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/schema/types.ts packages/tabletop-engine/src/schema/index.ts packages/tabletop-engine/src/index.ts packages/tabletop-engine/tests/types.test.ts packages/tabletop-engine/tests/schema.test.ts
git commit -m "refactor: add recursive serializable schema types"
```

### Task 3: Add runtime fail-fast errors for nested state references

**Files:**

- Modify: `packages/tabletop-engine/src/schema/index.ts`
- Modify: `packages/tabletop-engine/tests/schema.test.ts`

**Step 1: Replace silent fallback**

Today nested `t.state(...)` in schema composition degrades to `Type.Unknown()`. Replace that path with an explicit throw, using a clear error such as:

```ts
state_field_not_allowed_in_serializable_schema;
```

This should fire from:

- `t.object(...)`
- `t.array(...)`
- `t.record(...)`
- `t.optional(...)`

when nested serializable composition encounters `kind: "state"`.

**Step 2: Run targeted runtime tests**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/schema.test.ts
```

Expected:

- PASS with explicit throw behavior

**Step 3: Commit**

```bash
git add packages/tabletop-engine/src/schema/index.ts packages/tabletop-engine/tests/schema.test.ts
git commit -m "feat: fail fast on state refs in serializable schemas"
```

### Task 4: Apply the stricter schema type to transport/view surfaces

**Files:**

- Modify: `packages/tabletop-engine/src/types/command.ts`
- Modify: `packages/tabletop-engine/src/state-facade/metadata.ts`
- Modify: `packages/tabletop-engine/src/protocol/describe.ts`
- Modify: `packages/tabletop-engine/tests/types.test.ts`
- Modify: `packages/tabletop-engine/tests/protocol.test.ts`

**Step 1: Tighten command/discovery schema authoring**

Update `CommandSchema` so its `schema` property uses the transport-safe serializable schema type instead of raw `TSchema`.

This should affect:

- command input schema
- discovery input schema

**Step 2: Tighten hidden-summary and custom-view schema authoring**

Update:

- `HiddenSummaryOptions.schema`
- `viewSchema(...)`

to use the same serializable schema type.

**Step 3: Keep protocol handling consistent**

Make sure `describeGameProtocol(...)` still receives the same serializable transport schemas and does not need any state-specific special cases.

**Step 4: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/types.test.ts tests/protocol.test.ts
```

Expected:

- PASS with stricter transport-schema authoring

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/types/command.ts packages/tabletop-engine/src/state-facade/metadata.ts packages/tabletop-engine/src/protocol/describe.ts packages/tabletop-engine/tests/types.test.ts packages/tabletop-engine/tests/protocol.test.ts
git commit -m "refactor: restrict transport schema authoring"
```

### Task 5: Full verification

**Files:**

- Verify only

**Step 1: Run full verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected:

- all commands PASS

**Step 2: Commit any follow-up fix separately**

If full verification finds a regression, fix it in the smallest possible patch and commit with a narrow message.
