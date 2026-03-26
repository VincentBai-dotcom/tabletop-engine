# Feedback 5: Command List Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let `GameDefinitionBuilder` accept commands as a list of command instances instead of forcing long chains of individual `.command(...)` calls.

**Architecture:** Extend the builder introduced in feedback 1 so it can accept a list of command definitions/classes, derive command identity from the command definition itself, and compile the list into the existing command map shape that the executor already uses.

**Tech Stack:** TypeScript, Bun, existing `tabletop-kernel` command runtime, Bun test

---

### Task 1: Add failing tests for list-based command registration

**Files:**

- Modify: `packages/tabletop-kernel/tests/game-definition.test.ts`

**Step 1: Write the failing tests**

Add tests that:

- build a game definition with `.commands([new XCommand(), new YCommand()])`
- assert the resulting `GameDefinition.commands` map contains the expected command IDs
- assert duplicate command IDs are rejected clearly

**Step 2: Run tests to verify they fail**

Run: `bun test --cwd packages/tabletop-kernel packages/tabletop-kernel/tests/game-definition.test.ts`

Expected: FAIL because builder list support does not exist yet.

### Task 2: Define how command identity is read from class-based commands

**Files:**

- Modify: `packages/tabletop-kernel/src/types/command.ts`
- Modify: `packages/tabletop-kernel/src/game-definition.ts`

**Step 1: Add a command identity field**

Introduce the minimal command-definition shape needed for class-based registration, for example an explicit `type` property on command definitions/classes used by builder list registration.

**Step 2: Keep current object-map support intact**

Do not remove the existing `commands: { ... }` `GameDefinition` core shape. Only add builder-side list handling.

**Step 3: Run focused tests if helpful**

Run: `bun test --cwd packages/tabletop-kernel packages/tabletop-kernel/tests/game-definition.test.ts`

Expected: still failing until list support is implemented.

### Task 3: Implement builder-side list compilation

**Files:**

- Modify: `packages/tabletop-kernel/src/game-definition.ts`

**Step 1: Add `.commands(...)` overload or equivalent**

Support passing a list of command instances/definitions into the builder.

**Step 2: Compile list to command map**

During `.build()`, convert the list into the existing `Record<string, CommandDefinition>` shape.

**Step 3: Validate uniqueness**

Throw a clear error if two commands declare the same identity.

**Step 4: Run focused tests**

Run: `bun test --cwd packages/tabletop-kernel packages/tabletop-kernel/tests/game-definition.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/types/command.ts packages/tabletop-kernel/src/game-definition.ts packages/tabletop-kernel/tests/game-definition.test.ts
git commit -m "feat: support command lists in game definition builder"
```

### Task 4: Migrate the Splendor example to command-list registration

**Files:**

- Modify: `examples/splendor/src/commands/index.ts`
- Modify: `examples/splendor/src/game.ts`

**Step 1: Expose a list-based command collection**

Update the Splendor command module to provide a list of command instances/definitions compatible with the new builder API.

**Step 2: Update the game definition**

Replace the current object-map style registration in the Splendor game definition builder usage with the new command list.

**Step 3: Run focused tests**

Run: `bun test --cwd examples/splendor`

Expected: PASS

**Step 4: Commit**

```bash
git add examples/splendor/src/commands/index.ts examples/splendor/src/game.ts
git commit -m "refactor: register splendor commands as a list"
```

### Task 5: Run full verification and open PR

**Step 1: Run full verification**

Run:

- `bun run lint`
- `bunx tsc -b`
- `bun test --cwd packages/tabletop-kernel`
- `bun test --cwd examples/splendor`
- `bun test --cwd examples/splendor-terminal`

Expected: all PASS

**Step 2: Push branch**

Use a dedicated branch, for example:

- `feedback-5-command-list-builder`

**Step 3: Open PR against `main`**

PR title suggestion:

- `feat: support command lists in GameDefinitionBuilder`

**Step 4: Stop for review**

Do not start any later breaking consumer-experience work until the user reviews the PR.
