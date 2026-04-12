# Visibility Configuration Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace visibility decorators with `configureVisibility(...)`, compile visibility projection plans at build time, remove legacy visibility code, and migrate the engine tests and Splendor example.

**Architecture:** Keep `@State()` and `@field(t(...))` for canonical state authoring, but move visibility and ownership metadata to explicit registration in `state-facade/metadata.ts`. Compile that metadata into per-state visibility plans during facade compilation, and make both `getView(...)` and protocol schema generation consume the same compiled visibility model.

**Tech Stack:** TypeScript, Bun, TypeBox, existing `tabletop-engine` state-facade runtime.

---

### Task 1: Lock the new visibility API with failing metadata tests

**Files:**

- Modify: `packages/tabletop-engine/tests/state-facade.test.ts`
- Modify: `packages/tabletop-engine/tests/protocol.test.ts`

**Step 1: Add failing tests for `configureVisibility(...)` metadata**

Add tests that define small state classes with:

- `configureVisibility(StateClass, { ownedBy: "id", fields: { secret: visibleToSelf() } })`
- `configureVisibility(StateClass, { fields: { deck: hidden({ summary: ..., derive(...) { ... } }) } })`

Assert:

- `getView(...)` still hides fields correctly
- visible-to-self fields are visible to the owner and hidden to others
- hidden summary values use inline `derive(...)`
- `describeGameProtocol(...)` emits the matching hidden envelope schemas

**Step 2: Run targeted tests to verify they fail**

Run:

```bash
bun test --cwd packages/tabletop-engine ./tests/state-facade.test.ts ./tests/protocol.test.ts
```

Expected:

- FAIL because `configureVisibility`, `hidden`, and `visibleToSelf` config registration do not exist yet in the new shape

**Step 3: Commit the failing tests**

```bash
git add packages/tabletop-engine/tests/state-facade.test.ts packages/tabletop-engine/tests/protocol.test.ts
git commit -m "test: lock visibility configuration api"
```

### Task 2: Replace legacy metadata decorators with explicit visibility registration

**Files:**

- Modify: `packages/tabletop-engine/src/state-facade/metadata.ts`
- Modify: `packages/tabletop-engine/src/index.ts`
- Modify: `packages/tabletop-engine/tests/game-definition.test.ts`

**Step 1: Introduce new metadata types**

In `metadata.ts`, replace decorator-oriented visibility metadata with explicit configuration types:

- `VisibilityRuleKind`
- `HiddenFieldVisibilityConfig`
- `VisibleToSelfFieldVisibilityConfig`
- `FieldVisibilityConfig`
- `StateVisibilityConfig`

Keep field metadata and `@State()` / `@field(...)` intact.

**Step 2: Add `configureVisibility(...)` registration**

Implement:

- `configureVisibility(target, config)`

Store on state metadata:

- `ownedByField?: string`
- `fieldVisibility: Record<string, FieldVisibilityConfig>`

Delete:

- `OwnedByPlayer()`
- `hidden(...)` decorator
- `visibleToSelf(...)` decorator
- `viewSchema(...)`
- `customViewSchema` metadata

**Step 3: Update engine exports**

Export:

- `configureVisibility`
- config-driven `hidden(...)`
- config-driven `visibleToSelf(...)`

Remove the legacy visibility decorator exports from `index.ts`.

**Step 4: Add metadata validation**

Validate in `getStateMetadata` consumers or compile step:

- `ownedBy` references an existing field
- the referenced field is `t.string()`

**Step 5: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine ./tests/game-definition.test.ts ./tests/state-facade.test.ts ./tests/protocol.test.ts
```

Expected:

- metadata tests still fail in projection/protocol paths
- no remaining compile errors around removed decorator exports in the touched tests

**Step 6: Commit**

```bash
git add packages/tabletop-engine/src/state-facade/metadata.ts packages/tabletop-engine/src/index.ts packages/tabletop-engine/tests/game-definition.test.ts packages/tabletop-engine/tests/state-facade.test.ts packages/tabletop-engine/tests/protocol.test.ts
git commit -m "refactor: register visibility through configureVisibility"
```

### Task 3: Compile visibility plans during state-facade compilation

**Files:**

- Modify: `packages/tabletop-engine/src/state-facade/compile.ts`
- Modify: `packages/tabletop-engine/src/state-facade/metadata.ts`
- Test: `packages/tabletop-engine/tests/game-definition.test.ts`

**Step 1: Replace compiled visibility shape**

Update compiled state definitions to store:

- `ownedByField?: string`
- `fieldPlans: Record<string, CompiledVisibilityFieldPlan>`

Where each field plan carries:

- canonical `fieldType`
- `visibility?: FieldVisibilityConfig`
- prevalidated summary schema / derive hook reference
- nested projection strategy kind

**Step 2: Validate compile-time visibility requirements**

At compile time:

- `visibleToSelf(...)` requires an owning field on this state or an owning ancestor
- each configured visibility field exists in `fields`
- summary schema is serializable

**Step 3: Remove compiled legacy fields**

Delete from compiled state definitions:

- `fieldVisibility`
- `ownedByPlayer`
- `customViewSchema`

**Step 4: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine ./tests/game-definition.test.ts
```

Expected:

- compile-time validation tests pass or expose the next projection/protocol break

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/state-facade/compile.ts packages/tabletop-engine/src/state-facade/metadata.ts packages/tabletop-engine/tests/game-definition.test.ts
git commit -m "refactor: compile visibility field plans"
```

### Task 4: Refactor `getView(...)` to use compiled projector plans

**Files:**

- Modify: `packages/tabletop-engine/src/state-facade/project.ts`
- Modify: `packages/tabletop-engine/src/runtime/game-executor.ts`
- Test: `packages/tabletop-engine/tests/game-execution.test.ts`
- Test: `packages/tabletop-engine/tests/state-facade.test.ts`

**Step 1: Remove custom view hook support**

Delete:

- `projectStateNodeWithCustomHook(...)`
- `projectCustomView(...)` runtime path

**Step 2: Replace reflective projection with compiled field-plan execution**

Implement per-state projector execution that:

- reads `ownedByField`
- resolves the next owner id once per node
- iterates compiled field plans
- applies hidden transforms only where configured
- recurses only through schema-known nested state structures

Use clearer names:

- `canonicalNode`
- `projectedNode`
- `nextOwnerId`
- `compiledState`
- `fieldPlan`

**Step 3: Keep fallback behavior for games without compiled state**

If no compiled facade exists, `getView(...)` should still structured-clone the canonical game state.

**Step 4: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine ./tests/game-execution.test.ts ./tests/state-facade.test.ts
```

Expected:

- visibility behavior passes without legacy decorators
- custom-view tests fail and are ready for removal/replacement

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/state-facade/project.ts packages/tabletop-engine/src/runtime/game-executor.ts packages/tabletop-engine/tests/game-execution.test.ts packages/tabletop-engine/tests/state-facade.test.ts
git commit -m "refactor: project state through compiled visibility plans"
```

### Task 5: Refactor protocol description to consume compiled visibility plans

**Files:**

- Modify: `packages/tabletop-engine/src/protocol/describe.ts`
- Test: `packages/tabletop-engine/tests/protocol.test.ts`
- Test: `packages/tabletop-engine/tests/asyncapi.test.ts`

**Step 1: Remove custom view schema handling**

Delete:

- `customViews` accumulation from state methods
- `projectCustomView` validation branches

If `GameProtocolDescriptor` still needs `customViews`, remove the field entirely.

**Step 2: Derive visible field schemas from compiled field plans**

Make visible schema inference consume:

- compiled state field plans
- `hidden(...)`
- `visibleToSelf(...)`
- nested state/array/record/object/optional recursion

Use the same hidden-envelope semantics as runtime projection.

**Step 3: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine ./tests/protocol.test.ts ./tests/asyncapi.test.ts
```

Expected:

- protocol and AsyncAPI tests pass with the new visibility model

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/protocol/describe.ts packages/tabletop-engine/tests/protocol.test.ts packages/tabletop-engine/tests/asyncapi.test.ts
git commit -m "refactor: describe protocol from compiled visibility plans"
```

### Task 6: Migrate Splendor and engine tests to `configureVisibility(...)`

**Files:**

- Modify: `examples/splendor/src/states/player-state.ts`
- Modify: `examples/splendor/src/states/board-state.ts`
- Modify: `examples/splendor/tests/game.test.ts`
- Modify: `packages/tabletop-engine/tests/game-execution.test.ts`
- Modify: `packages/tabletop-engine/tests/state-facade.test.ts`
- Modify: `packages/tabletop-engine/tests/protocol.test.ts`
- Modify: `packages/tabletop-engine/tests/asyncapi.test.ts`
- Modify: `packages/tabletop-engine/tests/schema.test.ts`

**Step 1: Replace decorator visibility usage in Splendor**

Convert:

- `@OwnedByPlayer()` to `configureVisibility(..., { ownedBy: "id" })`
- `@hidden(...)` to config `hidden(...)`
- `@visibleToSelf(...)` to config `visibleToSelf(...)`

Use inline `derive(...)` where summaries are needed.

**Step 2: Replace visibility decorators in engine tests**

Update all visibility-related test fixtures to use `configureVisibility(...)`.

Delete or rewrite tests that only exist for:

- `projectCustomView(...)`
- `viewSchema(...)`
- legacy decorator-specific validation

**Step 3: Run test suites**

Run:

```bash
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
```

Expected:

- both suites pass without legacy visibility decorators

**Step 4: Commit**

```bash
git add examples/splendor/src/states/player-state.ts examples/splendor/src/states/board-state.ts examples/splendor/tests/game.test.ts packages/tabletop-engine/tests/game-execution.test.ts packages/tabletop-engine/tests/state-facade.test.ts packages/tabletop-engine/tests/protocol.test.ts packages/tabletop-engine/tests/asyncapi.test.ts packages/tabletop-engine/tests/schema.test.ts
git commit -m "refactor: migrate visibility authoring to configureVisibility"
```

### Task 7: Remove legacy visibility code and documentation

**Files:**

- Modify: `packages/tabletop-engine/src/index.ts`
- Modify: `packages/tabletop-engine/src/types/visibility.ts`
- Modify: `docs/design/2026-04-12-visibility-configuration-redesign.md`
- Search/update: `README*`, `AGENTS.md`, engine/example docs as needed

**Step 1: Remove all legacy symbols**

Delete any remaining code paths or exports for:

- `@OwnedByPlayer()`
- `@hidden`
- `@visibleToSelf`
- `projectCustomView(...)`
- `viewSchema(...)`

Ensure no dead types remain that only supported the legacy runtime path.

**Step 2: Update docs**

Update any examples or docs that still mention the old visibility decorators.

**Step 3: Run full verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected:

- all commands pass

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/index.ts packages/tabletop-engine/src/types/visibility.ts docs/design/2026-04-12-visibility-configuration-redesign.md README.md AGENTS.md
git commit -m "refactor: remove legacy visibility decorators"
```
