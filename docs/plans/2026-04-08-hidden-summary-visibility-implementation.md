# Hidden Summary Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add hidden-summary support to `@hidden(...)` and `@visibleToSelf(...)`, then update Splendor and the terminal example to consume only projected visible state.

**Architecture:** Extend field-level visibility metadata so hidden and self-visible fields can optionally provide a serializable summary payload. Update runtime projection and visible schema generation to emit `{ __hidden: true, value }` when configured. Keep this first implementation scoped to hidden-summary support only; do not yet enforce the `t.state(...)` ban in summary schemas.

**Tech Stack:** TypeScript, Bun tests, TypeBox-backed `t` schema metadata, state-facade visibility projection, Splendor example state facades.

---

### Task 1: Lock hidden-summary projection behavior in engine tests

**Files:**

- Modify: `packages/tabletop-engine/tests/state-facade.test.ts`
- Modify: `packages/tabletop-engine/tests/game-execution.test.ts`
- Modify: `packages/tabletop-engine/tests/protocol.test.ts`

**Step 1: Write failing projection tests**

Add coverage for:

- `@hidden({ schema, project })` returning `{ __hidden: true, value }`
- `@visibleToSelf({ schema, project })` returning the real value for the owner and hidden envelope with `value` for non-owners
- protocol/view-schema generation including the hidden summary payload shape

**Step 2: Run targeted tests to confirm failure**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/state-facade.test.ts tests/game-execution.test.ts tests/protocol.test.ts
```

Expected:

- FAIL because the decorators do not yet accept config objects and the projector/schema behavior does not exist

**Step 3: Commit failing tests**

```bash
git add packages/tabletop-engine/tests/state-facade.test.ts packages/tabletop-engine/tests/game-execution.test.ts packages/tabletop-engine/tests/protocol.test.ts
git commit -m "test: lock hidden summary visibility behavior"
```

### Task 2: Implement hidden-summary metadata and runtime projection

**Files:**

- Modify: `packages/tabletop-engine/src/state-facade/metadata.ts`
- Modify: `packages/tabletop-engine/src/state-facade/compile.ts`
- Modify: `packages/tabletop-engine/src/state-facade/project.ts`
- Modify: `packages/tabletop-engine/src/types/visibility.ts`

**Step 1: Extend visibility metadata**

Add optional hidden-summary metadata to `FieldVisibilityMetadata`, including:

- summary schema
- summary projector

Update `hidden(...)` and `visibleToSelf(...)` to support both forms:

- no args
- `{ schema, project }`

**Step 2: Implement hidden envelope projection**

Update projection logic so hidden fields emit:

```ts
{
  __hidden: true;
}
```

or:

```ts
{ __hidden: true, value: projectedSummary }
```

when a projector is configured.

**Step 3: Keep owner behavior unchanged for `visibleToSelf(...)`**

Owners still receive the real projected value; only non-owners receive the hidden envelope.

**Step 4: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/state-facade.test.ts tests/game-execution.test.ts
```

Expected:

- PASS for the new hidden-summary projection behavior

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/state-facade/metadata.ts packages/tabletop-engine/src/state-facade/compile.ts packages/tabletop-engine/src/state-facade/project.ts packages/tabletop-engine/src/types/visibility.ts packages/tabletop-engine/tests/state-facade.test.ts packages/tabletop-engine/tests/game-execution.test.ts
git commit -m "feat: add hidden summary visibility projection"
```

### Task 3: Implement visible schema generation for hidden summaries

**Files:**

- Modify: `packages/tabletop-engine/src/protocol/describe.ts`
- Modify: `packages/tabletop-engine/tests/protocol.test.ts`

**Step 1: Extend visible-schema inference**

Update field view-schema inference so:

- hidden fields with no summary still use `{ __hidden: true }`
- hidden fields with summary use `{ __hidden: true, value: SummarySchema }`
- visible-to-self fields use a union of:
  - visible field schema
  - hidden envelope schema, optionally with `value`

**Step 2: Run targeted protocol tests**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/protocol.test.ts
```

Expected:

- PASS with summary payloads represented in visible state schema

**Step 3: Commit**

```bash
git add packages/tabletop-engine/src/protocol/describe.ts packages/tabletop-engine/tests/protocol.test.ts
git commit -m "feat: describe hidden summary view schemas"
```

### Task 4: Move Splendor to decorator-based visibility

**Files:**

- Modify: `examples/splendor/src/states/player-state.ts`
- Modify: `examples/splendor/src/states/board-state.ts`
- Modify: `examples/splendor/src/states/game-state.ts`
- Modify: `examples/splendor/tests/game.test.ts`

**Step 1: Add ownership and self-visible reserved cards**

Update `SplendorPlayerState` to:

- use `@OwnedByPlayer()`
- mark `reservedCardIds` with `@visibleToSelf({ schema, project })`

The hidden summary payload should expose reserved card count for non-owners.

**Step 2: Hide deck contents with summary counts**

Update `SplendorBoardState.deckByLevel` to use `@hidden({ schema, project })`
so visible views expose remaining deck counts per level instead of raw card ids.

**Step 3: Add example tests for visible projection**

Add or extend Splendor tests to assert:

- opponents cannot see your reserved card ids
- they do see a hidden summary count
- the board decks project hidden summary counts instead of raw ids

**Step 4: Run example tests**

Run:

```bash
bun test --cwd examples/splendor
```

Expected:

- PASS with Splendor visible-state assertions

**Step 5: Commit**

```bash
git add examples/splendor/src/states/player-state.ts examples/splendor/src/states/board-state.ts examples/splendor/src/states/game-state.ts examples/splendor/tests/game.test.ts
git commit -m "refactor: apply visibility decorators to splendor"
```

### Task 5: Make splendor-terminal render only visible state

**Files:**

- Modify: `examples/splendor-terminal/src/session.ts`
- Modify: `examples/splendor-terminal/src/types.ts`
- Modify: `examples/splendor-terminal/src/render.ts`
- Modify: `examples/splendor-terminal/src/main.ts`
- Modify: `examples/splendor-terminal/tests/render.test.ts`
- Modify: `examples/splendor-terminal/tests/session.test.ts`

**Step 1: Switch terminal session to store canonical state internally but expose player view**

Keep canonical state private for command/discovery execution, but add visible-state access through:

- `gameExecutor.getView(state, { kind: "player", playerId: "you" })`

Session/render callers should consume only that visible state.

**Step 2: Update render layer**

Change render types and helpers so they render:

- visible `game`
- visible `progression`
- hidden envelopes where applicable

Use the hidden summary payloads for:

- deck counts
- opponents’ reserved-card counts

**Step 3: Update terminal tests**

Add or extend tests to assert:

- render output uses hidden summaries rather than canonical deck contents
- session consumers only receive visible state

**Step 4: Run terminal tests**

Run:

```bash
bun test --cwd examples/splendor-terminal
```

Expected:

- PASS with visible-state-only terminal behavior

**Step 5: Commit**

```bash
git add examples/splendor-terminal/src/session.ts examples/splendor-terminal/src/types.ts examples/splendor-terminal/src/render.ts examples/splendor-terminal/src/main.ts examples/splendor-terminal/tests/render.test.ts examples/splendor-terminal/tests/session.test.ts
git commit -m "refactor: render splendor terminal from visible state"
```

### Task 6: Full verification

**Files:**

- Verify only

**Step 1: Run full repo verification**

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

**Step 2: Optional smoke test**

Run the terminal game locally and play two user turns to verify the visible-state render still behaves correctly.

**Step 3: Final commit if needed**

If verification required any follow-up fix, commit that separately with a narrow message.
