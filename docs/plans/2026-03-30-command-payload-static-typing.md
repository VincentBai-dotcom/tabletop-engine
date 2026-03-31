# Command Payload Static Typing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make command authoring use `typeof payloadSchema.static` as the single consumer payload type, with `CommandDefinition` generic over payload values instead of schema metadata.

**Architecture:** Keep runtime schema objects on command instances, but move command typing to payload-value generics. The engine should continue using `payloadSchema` for protocol generation while consumer code uses `.static`-derived payload types everywhere. Splendor will be the proving example and will keep explicit `validate()` checks for enum-like string and number values.

**Tech Stack:** TypeScript, TypeBox-backed `t`, tabletop-engine command/context types, Splendor example

---

### Task 1: Stabilize the schema `.static` type surface

**Files:**

- Modify: `packages/tabletop-engine/src/schema/types.ts`
- Modify: `packages/tabletop-engine/src/schema/index.ts`
- Test: `packages/tabletop-engine/tests/schema.test.ts`

**Step 1: Write a narrow failing type-level test**

Add or extend a schema test so this shape is exercised:

```ts
const payloadSchema = t.object({
  amount: t.optional(t.number()),
});

type Payload = typeof payloadSchema.static;
```

and confirm `Payload` becomes `{ amount?: number }`.

**Step 2: Run the targeted test/build and verify failure**

Run: `bunx tsc -b`

Expected: type failures in schema typing if `.static` is not preserved correctly.

**Step 3: Implement the minimal schema typing fix**

Make the schema field types preserve a natural `.static` type compatible with
TypeBox without needing `InferSchema`.

**Step 4: Run verification**

Run:

```bash
bunx tsc -b
bun test --cwd packages/tabletop-engine tests/schema.test.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/schema/types.ts packages/tabletop-engine/src/schema/index.ts packages/tabletop-engine/tests/schema.test.ts
git commit -m "refactor: expose schema static typing directly"
```

### Task 2: Make command typing payload-generic

**Files:**

- Modify: `packages/tabletop-engine/src/types/command.ts`
- Modify: `packages/tabletop-engine/src/index.ts`
- Test: `packages/tabletop-engine/tests/types.test.ts`
- Test: `packages/tabletop-engine/tests/protocol.test.ts`
- Test: `packages/tabletop-engine/tests/asyncapi.test.ts`

**Step 1: Write the failing tests**

Add or update tests so command definitions can be authored as:

```ts
type GainScorePayload = typeof gainScorePayloadSchema.static;

class GainScoreCommand implements CommandDefinition<
  TestState,
  GainScorePayload
> {
  payloadSchema = gainScorePayloadSchema;
}
```

and the command contexts expose `commandInput.payload` as `GainScorePayload`.

**Step 2: Run tests/build to verify failure**

Run:

```bash
bunx tsc -b
bun test --cwd packages/tabletop-engine tests/types.test.ts
```

Expected: failures around command generic expectations.

**Step 3: Implement the type refactor**

Change command typing so:

- the public and internal command generics are payload-value based
- `payloadSchema` stays required and is structurally checked
- protocol generation still reads the runtime schema from the property

**Step 4: Run focused verification**

Run:

```bash
bunx tsc -b
bun test --cwd packages/tabletop-engine tests/types.test.ts
bun test --cwd packages/tabletop-engine tests/protocol.test.ts
bun test --cwd packages/tabletop-engine tests/asyncapi.test.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/types/command.ts packages/tabletop-engine/src/index.ts packages/tabletop-engine/tests/types.test.ts packages/tabletop-engine/tests/protocol.test.ts packages/tabletop-engine/tests/asyncapi.test.ts
git commit -m "refactor: make command definitions payload-generic"
```

### Task 3: Migrate Splendor commands to payload-static typing

**Files:**

- Modify: `examples/splendor/src/commands/*.ts`
- Modify: `examples/splendor/src/commands/index.ts`
- Modify: `examples/splendor/src/game.ts`
- Modify: `examples/splendor/src/index.ts`
- Modify: `examples/splendor/src/state.ts`
- Test: `examples/splendor/tests/game.test.ts`
- Test: `examples/splendor-terminal/tests/actions.test.ts`

**Step 1: Write/keep the failing behavior tests**

Keep coverage for:

- invalid gem color rejected as `invalid_color`
- invalid development level rejected as `invalid_level`

**Step 2: Run the focused tests to verify behavior gap**

Run:

```bash
bun test --cwd examples/splendor tests/game.test.ts
```

Expected: failure before migration if explicit validate checks are missing.

**Step 3: Implement the command migration**

For each Splendor command:

- remove the manual schema alias type
- keep one schema constant
- derive payload type from `typeof payloadSchema.static`
- switch `CommandDefinition` / context aliases to payload types
- validate enum-like strings/numbers explicitly in `validate()`

Also remove the old payload interfaces from `state.ts` and re-export command
payload types from the package root.

**Step 4: Run focused verification**

Run:

```bash
bunx tsc -b
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected: pass.

**Step 5: Commit**

```bash
git add examples/splendor/src/commands examples/splendor/src/game.ts examples/splendor/src/index.ts examples/splendor/src/state.ts examples/splendor/tests/game.test.ts examples/splendor-terminal/tests/actions.test.ts
git commit -m "refactor: derive splendor command payloads from schema static types"
```

### Task 4: Full verification and cleanup

**Files:**

- Modify: any touched files if verification finds regressions

**Step 1: Run full verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected: all pass.

**Step 2: Fix any regressions minimally**

Only address failures caused by this refactor.

**Step 3: Re-run full verification**

Run the same commands again until green.

**Step 4: Commit**

```bash
git add packages/tabletop-engine examples/splendor examples/splendor-terminal
git commit -m "test: verify payload-static command typing migration"
```
