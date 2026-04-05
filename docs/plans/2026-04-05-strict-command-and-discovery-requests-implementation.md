# Strict Command And Discovery Requests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `Command` and `Discovery` strict engine request types with required `actorId` and `input`, and remove the current weak request contract from execution and discovery flows.

**Architecture:** Tighten the core request types in `types/command.ts`, rewire lifecycle contexts and executor APIs to use the strict shapes, then update protocol generation and example consumers to match. Keep runtime guards in the executor so malformed JavaScript callers still fail cleanly even after the TypeScript surface becomes strict.

**Tech Stack:** TypeScript, Bun, TypeBox, tabletop-engine runtime/tests, Splendor example, Splendor terminal client

---

### Task 1: Lock The Strict Request Contract With Failing Type And Runtime Tests

**Files:**

- Modify: `packages/tabletop-engine/tests/types.test.ts`
- Modify: `packages/tabletop-engine/tests/kernel-execution.test.ts`
- Modify: `packages/tabletop-engine/tests/asyncapi.test.ts`
- Modify: `packages/tabletop-engine/tests/protocol.test.ts`

**Step 1: Add type-level expectations for strict command and discovery requests**

Add assertions that:

- `Command<{ amount: number }>` requires both `actorId` and `input`
- `Discovery<{ selected: number }>` requires both `actorId` and `input`
- `validate()`, `execute()`, and `discover()` contexts expose non-optional `command.actorId`, `command.input`, `discovery.actorId`, and `discovery.input`

**Step 2: Add executor/runtime expectations for malformed raw calls**

Add tests in `kernel-execution.test.ts` that unsafe-cast malformed requests and verify the executor rejects:

- missing `actorId`
- missing `input`

Expected rejection reasons:

- `missing_actor_id`
- `missing_command_input`
- `missing_discovery_input`

**Step 3: Add protocol/AsyncAPI expectations**

Update tests so generated protocol documents expect:

- command submit `actorId` required
- discovery submit `actorId` required
- discovery submit `input` required

**Step 4: Run focused tests and confirm they fail for the right reasons**

Run:

```bash
bunx tsc -b
bun test --cwd packages/tabletop-engine
```

Expected: failures around the current weak request typing and protocol shapes.

**Step 5: Commit**

```bash
git add packages/tabletop-engine/tests/types.test.ts packages/tabletop-engine/tests/kernel-execution.test.ts packages/tabletop-engine/tests/asyncapi.test.ts packages/tabletop-engine/tests/protocol.test.ts
git commit -m "test: lock strict command request contract"
```

### Task 2: Replace Weak Request Types In Core Command Typing

**Files:**

- Modify: `packages/tabletop-engine/src/types/command.ts`

**Step 1: Replace exported `Command` and `Discovery` with strict shapes**

Make `actorId` and `input` required in the exported types:

```ts
export interface Command<
  Input extends Record<string, unknown> = Record<string, unknown>,
> {
  type: string;
  actorId: string;
  input: Input;
}
```

and the same for `Discovery`.

**Step 2: Update command lifecycle and internal context types**

Rewire:

- `CommandFromSchema`
- `ValidationContext`
- `ExecuteContext`
- `DiscoveryContext`
- `InternalValidationContext`
- `InternalExecuteContext`
- `InternalDiscoveryContext`
- `InternalCommandDefinition`

so they all use the strict request types.

**Step 3: Remove old weak request aliases if they are no longer needed**

Delete weak request variants if no code still depends on them. If a temporary raw ingress type is still required mid-migration, rename it explicitly rather than leaving it named `Command` or `Discovery`.

**Step 4: Run the build**

Run:

```bash
bunx tsc -b
```

Expected: downstream executor/consumer errors to fix next.

**Step 5: Commit**

```bash
git add packages/tabletop-engine/src/types/command.ts
git commit -m "refactor: make command requests strict"
```

### Task 3: Tighten Runtime Context Builders And Executor Boundaries

**Files:**

- Modify: `packages/tabletop-engine/src/runtime/contexts.ts`
- Modify: `packages/tabletop-engine/src/runtime/game-executor.ts`
- Modify: `packages/tabletop-engine/src/testing/harness.ts`
- Modify: `packages/tabletop-engine/src/replay/history.ts`

**Step 1: Update context constructors to require strict requests**

Change `createValidationContext`, `createExecuteContext`, and `createDiscoveryContext` so they accept strict `Command` / `Discovery` types.

**Step 2: Change executor APIs to accept strict requests**

Update `GameExecutor` and `createGameExecutor(...)` signatures so:

- `discoverCommand(...)` takes strict `Discovery`
- `executeCommand(...)` takes strict `Command`

**Step 3: Add runtime guards for unsafe JS callers**

In `game-executor.ts`, reject malformed requests even if they arrive through `unknown as Command`, with explicit failure reasons:

- `missing_actor_id`
- `missing_command_input`
- `missing_discovery_input`

**Step 4: Update helper utilities**

Fix harness and replay helpers to use the strict request type.

**Step 5: Run focused verification**

Run:

```bash
bunx tsc -b
bun test --cwd packages/tabletop-engine
```

**Step 6: Commit**

```bash
git add packages/tabletop-engine/src/runtime/contexts.ts packages/tabletop-engine/src/runtime/game-executor.ts packages/tabletop-engine/src/testing/harness.ts packages/tabletop-engine/src/replay/history.ts
git commit -m "refactor: require strict executor requests"
```

### Task 4: Align Protocol Generation With Strict Requests

**Files:**

- Modify: `packages/tabletop-engine/src/protocol/asyncapi.ts`
- Modify: `packages/tabletop-engine/src/protocol/describe.ts`
- Modify: `packages/tabletop-engine/tests/asyncapi.test.ts`
- Modify: `packages/tabletop-engine/tests/protocol.test.ts`

**Step 1: Make AsyncAPI request schemas strict**

Update generated request payloads:

- `command.submit`: require `actorId`, require `input`
- `command.discover`: require `actorId`, require `input`

**Step 2: Keep discovery result envelopes coherent**

If discovery requests now require `actorId`, require it in:

- discovery success envelope
- discovery rejection envelope

**Step 3: Re-run protocol tests**

Run:

```bash
bun test --cwd packages/tabletop-engine
```

**Step 4: Commit**

```bash
git add packages/tabletop-engine/src/protocol/asyncapi.ts packages/tabletop-engine/src/protocol/describe.ts packages/tabletop-engine/tests/asyncapi.test.ts packages/tabletop-engine/tests/protocol.test.ts
git commit -m "refactor: align protocol with strict requests"
```

### Task 5: Update Splendor And Terminal Consumer Types

**Files:**

- Modify: `examples/splendor/src/commands/buy-face-up-card.ts`
- Modify: `examples/splendor/src/commands/buy-reserved-card.ts`
- Modify: `examples/splendor/src/commands/reserve-deck-card.ts`
- Modify: `examples/splendor/src/commands/reserve-face-up-card.ts`
- Modify: `examples/splendor/src/commands/take-three-distinct-gems.ts`
- Modify: `examples/splendor/src/commands/take-two-same-gems.ts`
- Modify: `examples/splendor-terminal/src/types.ts`
- Modify: `examples/splendor-terminal/src/session.ts`

**Step 1: Remove non-null assertions from Splendor command logic**

Update Splendor commands so they use:

- `command.actorId`
- `command.input`

directly, with no `!`.

**Step 2: Tighten terminal command and discovery request aliases**

Update terminal types to use the strict `Command` / `Discovery` contract directly.

**Step 3: Fix any session/executor call sites**

Update `session.ts` or any other caller that relied on weak request typing.

**Step 4: Run example verification**

Run:

```bash
bunx tsc -b
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

**Step 5: Commit**

```bash
git add examples/splendor/src/commands examples/splendor-terminal/src/types.ts examples/splendor-terminal/src/session.ts
git commit -m "refactor: remove weak command request usage"
```

### Task 6: Full Verification And Manual Terminal Check

**Files:**

- No new files

**Step 1: Run full repo verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

**Step 2: Play two user turns in the terminal client**

Run the terminal client and verify:

- `Take gems white, blue, green`
- `Reserve L1 #9 Blue 0pt`

**Step 3: Commit any final fixes**

If verification required no code changes, skip this step. If it did:

```bash
git add <touched-files>
git commit -m "test: verify strict command requests end to end"
```
