# Command Factory Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace class-based command authoring with a `createCommandFactory(...)` / `defineCommand(...)` API and remove the legacy command-authoring path completely.

**Architecture:** Keep the runtime/executor/protocol layers operating on the same structural command object shape, and move the migration effort into the command authoring/type boundary. Add a game-bound factory that contextually types command lifecycle methods from `payloadSchema` and `discoveryDraftSchema`, then migrate the Splendor example and tests to that new API.

**Tech Stack:** TypeScript, Bun, TypeBox-backed schema API, decorator-based state facade system

---

### Task 1: Add failing tests for factory-based command authoring

**Files:**

- Modify: `packages/tabletop-engine/tests/types.test.ts`
- Modify: `packages/tabletop-engine/tests/game-definition.test.ts`

**Step 1: Write the failing typing/runtime tests**

Add tests that prove:

- `createCommandFactory<GameState>()` exists
- `payloadSchema` drives `validate` / `execute` payload typing
- `discoveryDraftSchema` drives `discover` draft typing
- `discover` without `discoveryDraftSchema` is rejected at type level
- `discoveryDraftSchema` without `discover` is rejected at type level or runtime shape validation

**Step 2: Run the targeted tests to verify they fail**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/types.test.ts
bun test --cwd packages/tabletop-engine tests/game-definition.test.ts
```

Expected:

- typing/runtime failures because the factory API does not exist yet

**Step 3: Commit**

```bash
git add packages/tabletop-engine/tests/types.test.ts packages/tabletop-engine/tests/game-definition.test.ts
git commit -m "test: add command factory coverage"
```

### Task 2: Implement `createCommandFactory(...)`

**Files:**

- Modify: `packages/tabletop-engine/src/types/command.ts`
- Modify: `packages/tabletop-engine/src/index.ts`
- Add or Modify: `packages/tabletop-engine/src/command-factory.ts`

**Step 1: Add the minimal factory implementation**

Implement:

- `createCommandFactory<FacadeGameState>()`
- `defineCommand(config)` returned from the factory

Use a config union so:

- non-discoverable commands cannot define `discoveryDraftSchema`
- discoverable commands must define both `discover` and `discoveryDraftSchema`

Keep the return shape compatible with existing runtime consumers:

- `commandId`
- `payloadSchema`
- `discoveryDraftSchema?`
- `isAvailable?`
- `discover?`
- `validate`
- `execute`

**Step 2: Keep `CommandDefinition` as the structural object type**

Do not retain the class-oriented public authoring model.

The type surface should now support factory-authored commands directly and no longer optimize for `class ... implements CommandDefinition`.

**Step 3: Run the targeted tests to verify they pass**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/types.test.ts
bun test --cwd packages/tabletop-engine tests/game-definition.test.ts
```

Expected:

- PASS

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/types/command.ts packages/tabletop-engine/src/index.ts packages/tabletop-engine/src/command-factory.ts packages/tabletop-engine/tests/types.test.ts packages/tabletop-engine/tests/game-definition.test.ts
git commit -m "feat: add command factory api"
```

### Task 3: Remove legacy class-based command authoring support

**Files:**

- Modify: `packages/tabletop-engine/src/types/command.ts`
- Modify: any engine tests still exercising class command authoring

**Step 1: Remove legacy class-oriented command typing paths**

Delete or simplify type paths kept only for class-style command authoring.

This includes:

- avoiding compatibility affordances that only exist for `implements CommandDefinition`
- updating tests so they validate the new object/factory authoring flow instead

**Step 2: Run targeted engine tests**

Run:

```bash
bun test --cwd packages/tabletop-engine
```

Expected:

- PASS

**Step 3: Commit**

```bash
git add packages/tabletop-engine/src/types/command.ts packages/tabletop-engine/tests
git commit -m "refactor: remove legacy command authoring path"
```

### Task 4: Migrate Splendor commands to `defineCommand(...)`

**Files:**

- Modify: `examples/splendor/src/commands/*.ts`
- Modify: `examples/splendor/src/commands/index.ts`
- Modify: `examples/splendor/src/commands/shared.ts`

**Step 1: Introduce the game-bound Splendor command factory**

Create a single:

```ts
const defineSplendorCommand = createCommandFactory<SplendorGameState>();
```

Use it across all Splendor commands.

**Step 2: Replace class commands with factory-authored command objects**

For each Splendor command:

- remove `class ...`
- export a command object from `defineSplendorCommand(...)`
- keep existing payload/draft schemas
- keep existing logic

**Step 3: Remove local command context aliases**

Delete command-context aliases from:

- `examples/splendor/src/commands/shared.ts`

Keep only domain helpers like:

- `readPayload`
- `readDraft`
- `assertAvailableActor`
- `guardedValidate`

**Step 4: Run example tests**

Run:

```bash
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected:

- PASS

**Step 5: Commit**

```bash
git add examples/splendor/src/commands examples/splendor/tests examples/splendor-terminal/tests examples/splendor-terminal/src
git commit -m "refactor: migrate splendor commands to command factory"
```

### Task 5: Verify end-to-end compatibility and clean up residual references

**Files:**

- Search the repo for remaining legacy command class patterns
- Update docs or type tests only if they still describe the old command path

**Step 1: Search for remaining legacy command authoring**

Run:

```bash
rg -n "implements CommandDefinition|class .*Command" packages/tabletop-engine examples/splendor
```

Expected:

- no remaining supported command-authoring references in engine or Splendor

**Step 2: Run full verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected:

- all pass

**Step 3: Commit**

```bash
git add -A
git commit -m "test: verify command factory migration"
```
