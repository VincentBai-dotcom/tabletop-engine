# CLI Artifact Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the first working version of `tabletop-cli` with shared game-loading utilities plus `generate types`, `generate schemas`, `generate protocol`, `generate client-sdk`, and `validate` commands.

**Architecture:** Build a small internal CLI around a reusable generation context: parse common flags, load a game module, resolve the built `GameDefinition`, and then route to per-command generators that materialize files in a target output directory. Use engine-owned runtime artifacts as the source of truth and keep generated output simple, deterministic, and intentionally narrow for v1.

**Tech Stack:** Bun workspaces, TypeScript, Bun test, `tabletop-engine`, TypeBox runtime schemas

---

### Task 1: Add reusable CLI context and game loading

**Files:**

- Create: `packages/cli/src/lib/load-game.ts`
- Create: `packages/cli/src/lib/generation-context.ts`
- Create: `packages/cli/src/lib/write-output.ts`
- Modify: `packages/cli/src/lib/parse-args.ts`
- Test: `packages/cli/tests/load-game.test.ts`

**Step 1: Write the failing tests**

Add tests covering:

- resolving `--game examples/splendor/src/game.ts`
- default export or named export resolution when `--export` is omitted
- explicit export resolution when `--export createSplendorGame` is provided
- failure when the export does not resolve to a game definition or game factory
- output-directory resolution for `--outDir`

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/cli packages/cli/tests/load-game.test.ts`
Expected: FAIL because the utilities do not exist yet.

**Step 3: Write the minimal implementation**

Implement:

- `parseArgs(argv)` for:
  - `--game`
  - `--export`
  - `--outDir`
- `loadGame(options)` that:
  - resolves the module path relative to cwd
  - imports the module via file URL
  - resolves either:
    - the explicit named export
    - the default export
    - one conventional exported factory when unambiguous
  - accepts either:
    - a built game definition
    - a zero-argument factory returning a built game definition
- `createGenerationContext(...)` that returns:
  - `game`
  - `gameModulePath`
  - `outputDirectory`
  - derived file basenames
- `writeOutputFile(...)` helper that creates parent directories and writes text

**Step 4: Run tests to verify they pass**

Run: `bun test --cwd packages/cli packages/cli/tests/load-game.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib packages/cli/tests/load-game.test.ts
git commit -m "feat: add cli game loading utilities"
```

### Task 2: Implement `generate schemas`

**Files:**

- Create: `packages/cli/src/commands/generate-schemas.ts`
- Modify: `packages/cli/src/commands/generate.ts`
- Modify: `packages/cli/src/lib/help-text.ts`
- Test: `packages/cli/tests/generate-schemas.test.ts`

**Step 1: Write the failing test**

Add a test that:

- runs the CLI with:
  - `generate schemas --game examples/splendor/src/game.ts --outDir /tmp/...`
- verifies a generated JSON file exists
- verifies that file contains:
  - canonical state schema
  - visible state schema
  - command schemas
  - discovery schemas when present

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/cli packages/cli/tests/generate-schemas.test.ts`
Expected: FAIL because `generate schemas` is still a scaffold stub.

**Step 3: Write the minimal implementation**

Use:

- built game definition
- `describeGameProtocol(game)`
- `game.canonicalGameStateSchema.schema`
- `game.runtimeStateSchema`

Emit one JSON file, for example:

- `schemas.generated.json`

Include:

- `canonicalState`
  - full `{ game, runtime }` schema
- `visibleState`
- `commands`
- `discoveries`

**Step 4: Run tests to verify they pass**

Run: `bun test --cwd packages/cli packages/cli/tests/generate-schemas.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/commands/generate-schemas.ts packages/cli/src/commands/generate.ts packages/cli/src/lib/help-text.ts packages/cli/tests/generate-schemas.test.ts
git commit -m "feat: add schema generation command"
```

### Task 3: Implement `generate protocol`

**Files:**

- Create: `packages/cli/src/commands/generate-protocol.ts`
- Modify: `packages/cli/src/commands/generate.ts`
- Test: `packages/cli/tests/generate-protocol.test.ts`

**Step 1: Write the failing test**

Add a test that:

- runs `generate protocol --game examples/splendor/src/game.ts --outDir /tmp/...`
- verifies a JSON file is created
- verifies the file includes protocol descriptor fields such as:
  - `name`
  - `commands`
  - `viewSchema`

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/cli packages/cli/tests/generate-protocol.test.ts`
Expected: FAIL because `generate protocol` is not implemented.

**Step 3: Write the minimal implementation**

Use:

- `describeGameProtocol(game)`

Emit:

- `protocol.generated.json`

**Step 4: Run tests to verify they pass**

Run: `bun test --cwd packages/cli packages/cli/tests/generate-protocol.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/commands/generate-protocol.ts packages/cli/src/commands/generate.ts packages/cli/tests/generate-protocol.test.ts
git commit -m "feat: add protocol generation command"
```

### Task 4: Implement `generate types`

**Files:**

- Create: `packages/cli/src/lib/render-typescript.ts`
- Create: `packages/cli/src/commands/generate-types.ts`
- Modify: `packages/cli/src/commands/generate.ts`
- Test: `packages/cli/tests/generate-types.test.ts`

**Step 1: Write the failing test**

Add a test that:

- runs `generate types --game examples/splendor/src/game.ts --outDir /tmp/...`
- verifies:
  - `canonical-state.generated.d.ts`
  - `visible-state.generated.d.ts`
- checks the generated declarations contain:
  - `export interface CanonicalState`
  - `export interface VisibleState`
  - representative Splendor-visible fields such as `playerOrder`

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/cli packages/cli/tests/generate-types.test.ts`
Expected: FAIL because no type renderer exists yet.

**Step 3: Write the minimal implementation**

Implement a deterministic TypeScript renderer for the TypeBox subset currently
used by the engine outputs:

- object
- array
- record
- union / anyOf
- optional
- literal
- string / number / boolean / unknown

Render:

- full canonical state from:
  - `game.canonicalGameStateSchema.schema`
  - `game.runtimeStateSchema`
- full visible state from:
  - `describeGameProtocol(game).viewSchema`

Emit:

- `canonical-state.generated.d.ts`
- `visible-state.generated.d.ts`

**Step 4: Run tests to verify they pass**

Run: `bun test --cwd packages/cli packages/cli/tests/generate-types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/render-typescript.ts packages/cli/src/commands/generate-types.ts packages/cli/src/commands/generate.ts packages/cli/tests/generate-types.test.ts
git commit -m "feat: add type generation command"
```

### Task 5: Implement `generate client-sdk`

**Files:**

- Create: `packages/cli/src/commands/generate-client-sdk.ts`
- Modify: `packages/cli/src/commands/generate.ts`
- Test: `packages/cli/tests/generate-client-sdk.test.ts`

**Step 1: Write the failing test**

Add a test that:

- runs `generate client-sdk --game examples/splendor/src/game.ts --outDir /tmp/...`
- verifies a generated TS file exists
- verifies that file contains:
  - canonical and visible state exports or imports
  - command/discovery request shapes
  - a small typed client interface surface

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/cli packages/cli/tests/generate-client-sdk.test.ts`
Expected: FAIL because the command is still a scaffold stub.

**Step 3: Write the minimal implementation**

Generate a TS module that includes:

- `CanonicalState` type
- `VisibleState` type
- command request union
- discovery request union
- discovery result envelope types
- a minimal `GameClientSdk` interface with typed methods such as:
  - `getVisibleState()`
  - `submitCommand(...)`
  - `discover(...)`

This file can be self-contained by reusing the type renderer used in Task 4.

**Step 4: Run tests to verify they pass**

Run: `bun test --cwd packages/cli packages/cli/tests/generate-client-sdk.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/commands/generate-client-sdk.ts packages/cli/src/commands/generate.ts packages/cli/tests/generate-client-sdk.test.ts
git commit -m "feat: add client sdk generation command"
```

### Task 6: Implement `validate`

**Files:**

- Modify: `packages/cli/src/commands/validate.ts`
- Modify: `packages/cli/src/lib/help-text.ts`
- Test: `packages/cli/tests/validate.test.ts`

**Step 1: Write the failing test**

Add tests covering:

- `validate --game examples/splendor/src/game.ts`
  - succeeds when the game loads and builds
- `validate --game ... --snapshot path`
  - succeeds for a valid snapshot
  - fails for an invalid snapshot

Use a snapshot derived from `createGameExecutor(createSplendorGame()).createInitialState(...)`.

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/cli packages/cli/tests/validate.test.ts`
Expected: FAIL because `validate` only prints help today.

**Step 3: Write the minimal implementation**

Implement:

- game-definition validation by loading and building the game
- optional snapshot validation by:
  - reading JSON
  - validating full canonical state against:
    - `game.canonicalGameStateSchema`
    - `game.runtimeStateSchema`

Return success output on valid input and structured failure output on invalid
input.

**Step 4: Run tests to verify they pass**

Run: `bun test --cwd packages/cli packages/cli/tests/validate.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/commands/validate.ts packages/cli/src/lib/help-text.ts packages/cli/tests/validate.test.ts
git commit -m "feat: add validate command"
```

### Task 7: Final CLI integration verification

**Files:**

- Modify if needed: `packages/cli/package.json`
- Modify if needed: `docs/plans/2026-04-10-cli-package-scaffold.md`

**Step 1: Run focused CLI verification**

Run:

- `bun test --cwd packages/cli`
- `bunx tsc -b`
- `bun run lint`

Expected:

- CLI tests pass
- workspace typecheck passes
- lint passes

**Step 2: Run one manual smoke command**

Run a real command such as:

```bash
bun run --cwd packages/cli ./src/main.ts generate schemas --game ../../examples/splendor/src/game.ts --outDir /tmp/tabletop-cli-smoke
```

Expected:

- output files are written
- command exits successfully

**Step 3: Commit any small cleanup**

```bash
git add packages/cli
git commit -m "test: verify cli artifact generation"
```
