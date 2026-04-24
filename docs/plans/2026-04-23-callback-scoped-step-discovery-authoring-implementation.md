# Callback-Scoped Step Discovery Authoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current `discoverable(...builtSteps)` discovery authoring API with `discoverable((step) => [ ... ])`, preserving explicit `.initial()` and explicit per-option `nextStep` while restoring contextual facade typing without consumer-side helper exports.

**Architecture:** Keep the runtime discovery request/result shape unchanged. The change is at the authoring boundary: `discoverable(...)` should create a typed step factory inside the command-builder scope, the callback should return built step definitions, and the old helper-based API should be deleted rather than supported in parallel.

**Tech Stack:** TypeScript, Bun tests, tabletop-engine command builder/runtime/protocol, tabletop-cli generation, Splendor example game, Splendor terminal client.

---

### Task 1: Lock The Callback-Scoped Authoring Contract

**Files:**

- Modify: `packages/tabletop-engine/tests/command-factory.test.ts`
- Modify: `packages/tabletop-engine/tests/types.test.ts`

**Step 1: Update runtime tests to the new authoring shape**

Replace explicit helper-based tests with callback-scoped tests covering:

- `discoverable((step) => [step("a").initial()...build()])` works
- missing `.initial()` throws `command_builder_missing_initial_discovery_step`
- duplicate `.initial()` throws `command_builder_duplicate_initial_discovery_step`
- duplicate step ids still throw

**Step 2: Update type-surface tests**

Add or update assertions covering:

- the callback receives a typed step factory
- staged builder ordering is still enforced
- `discoverable((step) => [ ... ])` is accepted
- `discoverable(...steps)` is rejected
- top-level `discoveryStep(...)` is rejected or removed from the public API

**Step 3: Run targeted tests to confirm initial failure**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/command-factory.test.ts tests/types.test.ts
```

Expected: FAIL until the builder surface is updated.

**Step 4: Commit**

```bash
git add packages/tabletop-engine/tests/command-factory.test.ts packages/tabletop-engine/tests/types.test.ts
git commit -m "test: lock callback discovery step authoring"
```

### Task 2: Replace The Public Builder Surface

**Files:**

- Modify: `packages/tabletop-engine/src/types/command.ts`
- Modify: `packages/tabletop-engine/src/command-factory.ts`
- Modify: `packages/tabletop-engine/src/index.ts`

**Step 1: Change `discoverable(...)` typing**

In `packages/tabletop-engine/src/types/command.ts`:

- change `discoverable(...steps)` to `discoverable((step) => builtSteps)`
- type the callback-scoped step factory against the command builder's
  `FacadeGameState`
- keep `.initial()`, `.input(...)`, `.output(...)`, `.resolve(...)`, `.build()`
- keep `nextStep` required on non-complete options
- keep `defaultNextStep` removed

**Step 2: Remove helper-based public API**

In `packages/tabletop-engine/src/command-factory.ts` and
`packages/tabletop-engine/src/index.ts`:

- remove top-level exported `discoveryStep(...)`
- remove command-factory-bound `discoveryStep` helper surface
- create the typed step factory inside `discoverable(...)`
- keep the internal built-step machinery

**Step 3: Keep validation behavior**

Still in `packages/tabletop-engine/src/command-factory.ts`:

- require at least one step
- require exactly one `.initial()`
- require unique step ids
- preserve input/output/resolve validation

**Step 4: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/command-factory.test.ts tests/types.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/types/command.ts packages/tabletop-engine/src/command-factory.ts packages/tabletop-engine/src/index.ts packages/tabletop-engine/tests/command-factory.test.ts packages/tabletop-engine/tests/types.test.ts
git commit -m "feat: scope discovery step builder to discoverable"
```

### Task 3: Update Remaining Engine And CLI Call Sites

**Files:**

- Modify: `packages/tabletop-engine/tests/game-execution.test.ts`
- Modify: `packages/tabletop-engine/tests/protocol.test.ts`
- Modify: `packages/tabletop-engine/tests/asyncapi.test.ts`
- Modify: `packages/tabletop-engine/tests/schema.test.ts`
- Modify: `packages/cli/tests/generate-client-sdk.test.ts`
- Modify: `packages/cli/src/commands/generate-client-sdk.ts`
- Modify: `packages/cli/src/commands/generate-schemas.ts`

**Step 1: Migrate engine-owned tests to callback-scoped discovery**

Replace any remaining helper-based or old callback-chain authoring with:

```ts
.discoverable((step) => [
  step("a").initial().input(...).output(...).resolve(...).build(),
])
```

**Step 2: Keep CLI generation aligned**

Only make the minimal changes required to keep schema and SDK generation aligned
with the already-explicit descriptor shape.

**Step 3: Run targeted tests**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/game-execution.test.ts tests/protocol.test.ts tests/asyncapi.test.ts tests/schema.test.ts
bun test --cwd packages/cli
```

Expected: PASS

**Step 4: Commit**

```bash
git add packages/tabletop-engine/tests/game-execution.test.ts packages/tabletop-engine/tests/protocol.test.ts packages/tabletop-engine/tests/asyncapi.test.ts packages/tabletop-engine/tests/schema.test.ts packages/cli/src/commands/generate-client-sdk.ts packages/cli/tests/generate-client-sdk.test.ts packages/cli/src/commands/generate-schemas.ts
git commit -m "refactor: align engine and cli discovery call sites"
```

### Task 4: Migrate Splendor Command Authoring

**Files:**

- Modify: `examples/splendor/engine/src/commands/shared.ts`
- Modify: `examples/splendor/engine/src/commands/buy-face-up-card.ts`
- Modify: `examples/splendor/engine/src/commands/buy-reserved-card.ts`
- Modify: `examples/splendor/engine/src/commands/choose-noble.ts`
- Modify: `examples/splendor/engine/src/commands/reserve-deck-card.ts`
- Modify: `examples/splendor/engine/src/commands/reserve-face-up-card.ts`
- Modify: `examples/splendor/engine/src/commands/take-three-distinct-gems.ts`
- Modify: `examples/splendor/engine/src/commands/take-two-same-gems.ts`
- Modify: `examples/splendor/engine/tests/game.test.ts`

**Step 1: Remove helper-based step authoring**

Delete the temporary typed helper export in Splendor shared command code.

**Step 2: Convert every discoverable command**

Replace helper-based authoring with callback-scoped authoring:

```ts
.discoverable((step) => [
  step("...").initial()...build(),
  step("...")...build(),
])
```

Keep explicit `nextStep` everywhere it is needed.

**Step 3: Update tests**

Keep or update the Splendor engine tests so they still verify discovery flow
shape and progression.

**Step 4: Regenerate client SDK if needed**

Run:

```bash
bun run --cwd examples/splendor/engine generate:client-sdk
```

**Step 5: Run targeted tests**

Run:

```bash
bun test --cwd examples/splendor/engine
```

Expected: PASS

**Step 6: Commit**

```bash
git add examples/splendor/engine/src/commands/shared.ts examples/splendor/engine/src/commands/*.ts examples/splendor/engine/tests/game.test.ts examples/splendor/engine/generated/client-sdk.generated.ts
git commit -m "refactor: migrate splendor to callback discovery steps"
```

### Task 5: Verify Terminal Compatibility

**Files:**

- Modify only if needed: `examples/splendor/terminal/src/actions.ts`
- Modify only if needed: `examples/splendor/terminal/tests/actions.test.ts`

**Step 1: Run targeted terminal tests**

Run:

```bash
bun test --cwd examples/splendor/terminal
```

Expected: PASS, ideally without changes.

**Step 2: If changes are needed, keep them minimal**

Only update imports or generated-type assumptions that changed because of the
authoring-surface swap.

**Step 3: Commit only if there are real changes**

```bash
git add examples/splendor/terminal/src/actions.ts examples/splendor/terminal/tests/actions.test.ts
git commit -m "test: keep terminal compatible with callback discovery steps"
```

### Task 6: Full Verification And Gap Report

**Files:**

- No code changes expected

**Step 1: Run full verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd packages/cli
bun test --cwd examples/splendor/engine
bun test --cwd examples/splendor/terminal
bun test --cwd examples/splendor/server
```

Expected: all PASS.

**Step 2: Report any design-vs-implementation gaps**

Before finishing, explicitly state whether any technical issue forced a
deviation from:

- callback-scoped `discoverable((step) => [ ... ])`
- removal of helper-based discovery-step authoring
- explicit `.initial()`
- explicit per-option `nextStep`
- removal of order-based fallback behavior
