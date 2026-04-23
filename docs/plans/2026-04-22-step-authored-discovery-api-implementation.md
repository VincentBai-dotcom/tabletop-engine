# Step-Authored Discovery API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the legacy all-in-one discovery API with a step-authored discovery API and migrate protocol generation, CLI SDK generation, tests, and Splendor commands to the new model.

**Architecture:** Commands keep the same submit/validate/execute lifecycle, but discoverable commands now store ordered discovery step definitions instead of `discoverySchema` plus one `discover` handler. Runtime discovery receives an explicit `step`, runs only that step, validates input/output, and materializes explicit `nextStep` values from declaration order. Protocol and CLI generation consume the same step metadata to emit precise per-step request/result schemas and types.

**Tech Stack:** TypeScript, Bun tests, TypeBox-backed `t` schemas, tabletop-engine command factory/runtime/protocol, tabletop CLI artifact generation, Splendor example engine.

---

## Task 1: Add Step-Authored Discovery Types And Builder Surface

**Files:**

- Modify: `packages/tabletop-engine/src/types/command.ts`
- Modify: `packages/tabletop-engine/src/command-factory.ts`
- Test: `packages/tabletop-engine/tests/command-factory.test.ts`
- Test: `packages/tabletop-engine/tests/types.test.ts`

**Step 1: Write failing command factory tests**

Update `packages/tabletop-engine/tests/command-factory.test.ts`.

Replace the existing discoverable tests with step-authored expectations:

```ts
test("chained builder supports step-authored discovery", () => {
  const defineCommand = createCommandFactory<{ score: number }>();
  const commandSchema = t.object({ amount: t.number() });
  const selectAmountInputSchema = t.object({});
  const selectAmountOutputSchema = t.object({
    label: t.string(),
    amount: t.number(),
  });

  const command = defineCommand({
    commandId: "gain_score",
    commandSchema,
  })
    .discoverable((flow) =>
      flow.step("select_amount", (step) =>
        step
          .input(selectAmountInputSchema)
          .output(selectAmountOutputSchema)
          .resolve(() => [
            {
              id: "one",
              output: { label: "One", amount: 1 },
              nextInput: { amount: 1 },
            },
          ]),
      ),
    )
    .validate(({ command }) => {
      expect(command.input.amount).toBeNumber();
      return { ok: true as const };
    })
    .execute(({ game, command }) => {
      game.score += command.input.amount;
    })
    .build();

  expect(command.commandId).toBe("gain_score");
  expect(command.discovery).toBeDefined();
  expect(command.discovery?.startStep).toBe("select_amount");
  expect(command.discovery?.steps).toHaveLength(1);
  expect(command.discovery?.steps[0]?.stepId).toBe("select_amount");
  expect(command.discovery?.steps[0]?.inputSchema).toBe(
    selectAmountInputSchema,
  );
  expect(command.discovery?.steps[0]?.outputSchema).toBe(
    selectAmountOutputSchema,
  );
  expect(command.discovery?.steps[0]?.resolve).toBeFunction();
  expect("discoverySchema" in command).toBeFalse();
  expect("discover" in command).toBeFalse();
});
```

Add one test for two ordered steps:

```ts
expect(command.discovery?.steps[0]?.defaultNextStep).toBe("select_target");
expect(command.discovery?.steps[1]?.defaultNextStep).toBeUndefined();
```

Add one test that a resolver can return completion:

```ts
resolve: () => ({ complete: true as const, input: { amount: 1 } });
```

**Step 2: Write failing type tests**

Update `packages/tabletop-engine/tests/types.test.ts`.

Add a compile-time test that:

- `.discoverable((flow) => flow.step(...))` infers each step input in `resolve`
- each step option `output` must match `.output(...)`
- completion `input` must match the command schema
- legacy `.discoverable({ discoverySchema, discover })` is a type error

Use existing `@ts-expect-error` style in the file.

**Step 3: Run focused tests and verify red**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/command-factory.test.ts tests/types.test.ts
```

Expected: FAIL because the builder still expects the legacy object shape.

**Step 4: Implement command type model**

In `packages/tabletop-engine/src/types/command.ts`:

- change `Discovery` to include `step: string`
- remove `discoverySchema?: ...` and `discover?: ...` from public command definition shapes
- add:

```ts
export interface DiscoveryStepOption<
  TNextInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
> {
  id: string;
  output: TOutput;
  nextInput: TNextInput;
  nextStep?: string;
}

export type DiscoveryStepComplete<TCommandInput extends CommandData> = {
  complete: true;
  input: TCommandInput;
};

export type DiscoveryStepResult<
  TNextInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
  TCommandInput extends CommandData = CommandData,
> =
  | DiscoveryStepOption<TNextInput, TOutput>[]
  | DiscoveryStepComplete<TCommandInput>;

export interface DiscoveryStepDefinition<
  FacadeGameState extends object = object,
  TInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
  TCommandInput extends CommandData = CommandData,
> {
  stepId: string;
  inputSchema: CommandSchema<TInput>;
  outputSchema: CommandSchema<TOutput>;
  defaultNextStep?: string;
  resolve(
    context: DiscoveryStepContext<FacadeGameState, TInput>,
  ): DiscoveryStepResult<DiscoveryData, TOutput, TCommandInput>;
}

export interface DiscoveryDefinition<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
> {
  startStep: string;
  steps: DiscoveryStepDefinition<
    FacadeGameState,
    DiscoveryData,
    DiscoveryData,
    TCommandInput
  >[];
}
```

- define `DiscoveryStepContext` as `CommandAvailabilityContext & { discovery: Discovery<TInput>; input: TInput }`
- redefine `CommandDiscoveryResult` as the wire/runtime result:

```ts
export type CommandDiscoveryResult<
  TStep extends string = string,
  TNextInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
  TCommandInput extends CommandData = CommandData,
> =
  | {
      complete: false;
      step: TStep;
      options: Array<{
        id: string;
        output: TOutput;
        nextStep: string;
        nextInput: TNextInput;
      }>;
    }
  | {
      complete: true;
      input: TCommandInput;
    };
```

Keep aliases practical if exact generic precision becomes too expensive, but remove the legacy `metadata`-based result shape.

**Step 5: Implement builder runtime**

In `packages/tabletop-engine/src/command-factory.ts`:

- replace `.discoverable(config)` with `.discoverable((flow) => ...)`
- add an internal `createDiscoveryFlowBuilder`
- add an internal `createDiscoveryStepBuilder`
- ensure `.input(...).output(...).resolve(...)` is staged
- assert serializable schemas for step input and output
- calculate `defaultNextStep` after all steps are collected
- reject duplicate step IDs in builder finalization
- store `discovery: { startStep, steps }` on the command definition

**Step 6: Run focused tests and verify green**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/command-factory.test.ts tests/types.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add packages/tabletop-engine/src/types/command.ts packages/tabletop-engine/src/command-factory.ts packages/tabletop-engine/tests/command-factory.test.ts packages/tabletop-engine/tests/types.test.ts
git commit -m "feat: add step-authored discovery builder"
```

## Task 2: Update Runtime Discovery Execution

**Files:**

- Modify: `packages/tabletop-engine/src/runtime/contexts.ts`
- Modify: `packages/tabletop-engine/src/runtime/game-executor.ts`
- Test: `packages/tabletop-engine/tests/game-execution.test.ts`

**Step 1: Write failing runtime tests**

Update `packages/tabletop-engine/tests/game-execution.test.ts`.

Replace `game executor can discover the next semantic options for a command` with a step-authored test:

```ts
const commands = {
  play_card: defineCommand({
    commandId: "play_card",
    commandSchema: playCardCommandSchema,
  })
    .discoverable((flow) =>
      flow
        .step("select_card", (step) =>
          step
            .input(t.object({}))
            .output(t.object({ cardId: t.number(), label: t.string() }))
            .resolve(() => [
              {
                id: "card-1",
                output: { cardId: 1, label: "Card 1" },
                nextInput: { cardId: 1 },
              },
              {
                id: "card-2",
                output: { cardId: 2, label: "Card 2" },
                nextInput: { cardId: 2 },
              },
            ]),
        )
        .step("select_target", (step) =>
          step
            .input(t.object({ cardId: t.number() }))
            .output(t.object({ targetId: t.number() }))
            .resolve(({ input }) => [
              {
                id: "target-1",
                output: { targetId: 101 },
                nextInput: { cardId: input.cardId, targetId: 101 },
                nextStep: "select_target",
              },
            ]),
        ),
    )
    .isAvailable(({ game }) => game.canPlay)
    .validate(() => ({ ok: true as const }))
    .execute(() => {})
    .build(),
};
```

Assert:

- request must include `step`
- first step response includes materialized `nextStep: "select_target"`
- explicit loop `nextStep` is preserved
- unknown step returns `null`
- invalid input shape returns `null`
- non-discoverable command returns `null`

**Step 2: Run focused test and verify red**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/game-execution.test.ts
```

Expected: FAIL because executor still calls `definition.discover(...)`.

**Step 3: Update discovery context**

In `packages/tabletop-engine/src/runtime/contexts.ts`:

- update `createDiscoveryContext` to accept `Discovery<TInput>` and expose `input: discovery.input`
- return the new `InternalDiscoveryStepContext`

**Step 4: Update executor**

In `packages/tabletop-engine/src/runtime/game-executor.ts`:

- require `discovery.step` to be a non-empty string
- require `definition.discovery`
- find the requested step definition
- validate discovery input against the step input schema using existing schema validation helpers
- run the step resolver
- if completion: validate completion input against command schema and return `{ complete: true, input }`
- if options: validate each `output` against the step output schema
- materialize `nextStep` from option override or `step.defaultNextStep`
- reject/return `null` if no next step exists for an incomplete option
- reject/return `null` if `nextStep` is not a declared step

Prefer existing validation style in `game-executor.ts`. If current command input validation helpers are private inline logic, extract minimal local helpers.

**Step 5: Run focused test and verify green**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/game-execution.test.ts
```

Expected: PASS or only unrelated downstream tests fail due to old discovery authoring elsewhere in the same file. Fix all old discovery authoring in this file.

**Step 6: Commit**

```bash
git add packages/tabletop-engine/src/runtime/contexts.ts packages/tabletop-engine/src/runtime/game-executor.ts packages/tabletop-engine/tests/game-execution.test.ts
git commit -m "feat: execute step-authored discovery"
```

## Task 3: Update Protocol And AsyncAPI Generation

**Files:**

- Modify: `packages/tabletop-engine/src/protocol/describe.ts`
- Modify: `packages/tabletop-engine/src/protocol/asyncapi.ts`
- Test: `packages/tabletop-engine/tests/protocol.test.ts`
- Test: `packages/tabletop-engine/tests/asyncapi.test.ts`

**Step 1: Write failing protocol tests**

Update `packages/tabletop-engine/tests/protocol.test.ts`:

- author `gain_score` with `.discoverable((flow) => flow.step(...))`
- assert `protocol.commands.gain_score.discovery.startStep === "select_amount"`
- assert `protocol.commands.gain_score.discovery.steps[0]` includes `stepId`, `inputSchema`, `outputSchema`, `defaultNextStep`
- remove tests that mutate `discoverySchema`/`discover`
- add tests for malformed command definitions by casting and deleting `discovery.steps` or setting `steps: []`

**Step 2: Write failing AsyncAPI tests**

Update `packages/tabletop-engine/tests/asyncapi.test.ts`:

- discover command payload must include required `step`
- discover input schema must be per-step
- discovery result schema must include step-specific option `output`, materialized `nextStep`, and `nextInput`
- component schemas should include per-step names such as `GainScoreSelectAmountDiscoveryInput` and `GainScoreSelectAmountDiscoveryOutput` if practical

**Step 3: Run focused tests and verify red**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/protocol.test.ts tests/asyncapi.test.ts
```

Expected: FAIL because descriptor and AsyncAPI still expect `discoverySchema`.

**Step 4: Update protocol descriptor**

In `packages/tabletop-engine/src/protocol/describe.ts`:

- replace `discoverySchema?: ...` with `discovery?: ProtocolDiscoveryDescriptor`
- add descriptor types for ordered steps
- validate discoverable commands have at least one step
- validate duplicate/unknown next-step metadata if any static metadata exists
- include `startStep` and ordered `steps`

**Step 5: Update AsyncAPI generation**

In `packages/tabletop-engine/src/protocol/asyncapi.ts`:

- build discovery request variants per command step:
  - `type`
  - `actorId`
  - optional `requestId`
  - `step`
  - `input`
- build discovery result variants per command step:
  - incomplete result with `step`, `options`, option `output`, `nextStep`, `nextInput`
  - complete result with command input
- keep discovery rejected schema
- update component schemas names consistently

**Step 6: Run focused tests and verify green**

Run:

```bash
bun test --cwd packages/tabletop-engine tests/protocol.test.ts tests/asyncapi.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add packages/tabletop-engine/src/protocol/describe.ts packages/tabletop-engine/src/protocol/asyncapi.ts packages/tabletop-engine/tests/protocol.test.ts packages/tabletop-engine/tests/asyncapi.test.ts
git commit -m "feat: describe discovery steps in protocol"
```

## Task 4: Update CLI Schema And Client SDK Generation

**Files:**

- Modify: `packages/cli/src/commands/generate-schemas.ts`
- Modify: `packages/cli/src/commands/generate-client-sdk.ts`
- Test: `packages/cli/tests/generate-schemas.test.ts`
- Test: `packages/cli/tests/generate-client-sdk.test.ts`

**Step 1: Write failing CLI tests**

Update `packages/cli/tests/generate-schemas.test.ts`:

- expect generated `discoveries.take_three_distinct_gems.steps`
- expect the first step has `input` and `output`
- stop expecting the old single discovery schema shape

Update `packages/cli/tests/generate-client-sdk.test.ts`:

- expect generated `VisibleState`
- expect generated `CommandRequest`
- expect generated `DiscoveryRequest`
- expect generated `DiscoveryResult`
- expect generated discovery request includes `step:`
- expect generated discovery result includes `output`, `nextStep`, and `nextInput`
- remove expectations for `GameClientSdk`, `submitCommand`, and `discover` interface methods

**Step 2: Run focused CLI tests and verify red**

Run:

```bash
bun test --cwd packages/cli tests/generate-schemas.test.ts tests/generate-client-sdk.test.ts
```

Expected: FAIL because the CLI still emits old discovery schema and fake SDK interface.

**Step 3: Update schema generation**

In `packages/cli/src/commands/generate-schemas.ts`:

- output discovery step metadata from `protocol.commands[commandId].discovery`
- preserve command schemas as before

**Step 4: Update client SDK generation**

In `packages/cli/src/commands/generate-client-sdk.ts`:

- remove `CanonicalState` and `GameClientSdk` if no longer needed by the game-protocol SDK
- generate:
  - `VisibleState`
  - `CommandRequest`
  - `DiscoveryRequest`
  - `DiscoveryResult`
  - optional command/step aliases if simple
- render per-step request/result unions from protocol descriptor
- use `renderSchemaTypeString(...)` for step input/output and command schema

**Step 5: Run focused CLI tests and verify green**

Run:

```bash
bun test --cwd packages/cli tests/generate-schemas.test.ts tests/generate-client-sdk.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/cli/src/commands/generate-schemas.ts packages/cli/src/commands/generate-client-sdk.ts packages/cli/tests/generate-schemas.test.ts packages/cli/tests/generate-client-sdk.test.ts
git commit -m "feat: generate step discovery sdk types"
```

## Task 5: Migrate Splendor Commands And Generated Artifacts

**Files:**

- Modify: `examples/splendor/engine/src/discovery.ts`
- Modify: `examples/splendor/engine/src/commands/take-three-distinct-gems.ts`
- Modify: `examples/splendor/engine/src/commands/take-two-same-gems.ts`
- Modify: `examples/splendor/engine/src/commands/reserve-face-up-card.ts`
- Modify: `examples/splendor/engine/src/commands/reserve-deck-card.ts`
- Modify: `examples/splendor/engine/src/commands/buy-face-up-card.ts`
- Modify: `examples/splendor/engine/src/commands/buy-reserved-card.ts`
- Modify: `examples/splendor/engine/src/commands/choose-noble.ts`
- Modify: `examples/splendor/engine/src/index.ts`
- Create/Modify: `examples/splendor/engine/generated/client-sdk.generated.ts`
- Modify generated files in `examples/splendor/engine/generated/` as needed
- Test: `examples/splendor/engine/tests/game.test.ts`
- Test: `examples/splendor/terminal/tests/actions.test.ts`
- Test: `examples/splendor/terminal/tests/session.test.ts`

**Step 1: Run current Splendor tests and verify red after API removal**

Run:

```bash
bun test --cwd examples/splendor/engine
bun test --cwd examples/splendor/terminal
```

Expected after prior tasks: FAIL because Splendor still uses legacy `.discoverable({ discoverySchema, discover })` and old discovery request shape.

**Step 2: Migrate helper functions**

In `examples/splendor/engine/src/discovery.ts`:

- replace `completeDiscovery(...)` with a helper returning `{ complete: true, input }` if still useful
- replace `createReturnTokenDiscovery(...)` with a helper that returns step options with:
  - `id`
  - typed `output`
  - `nextStep: "select_return_token"` or the step ID passed in
  - `nextInput`
- replace `createNobleDiscovery(...)` similarly
- remove helpers that preserve the legacy `metadata` shape

**Step 3: Migrate simple card selection commands**

For commands like `buy-face-up-card` and `buy-reserved-card`:

- create explicit card selection step
- step input should be the shape required to run that step
- step output should include enough card display data for UI
- completion should return final command input

**Step 4: Migrate token return commands**

For `take-three-distinct-gems`, `take-two-same-gems`, `reserve-face-up-card`, and `reserve-deck-card`:

- create selection step(s)
- create `"select_return_token"` step
- token return step should loop with explicit `nextStep: "select_return_token"` until enough tokens are selected
- token return step should complete when no more return is required

**Step 5: Migrate noble choice**

For `choose-noble`:

- create `"select_noble"` step
- output should include noble display metadata
- completion should return final command input

**Step 6: Update terminal usage**

Search for `discoverCommand(` in `examples/splendor/terminal`.

Update any discovery calls to include `step`. If terminal logic previously inferred step from result, use returned `nextStep`.

**Step 7: Regenerate engine artifacts**

Run from `examples/splendor/engine`:

```bash
bun run generate:types
bun run generate:client-sdk
bun run generate:asyncapi
```

If scripts do not exist yet for `generate:client-sdk`, add the minimal package script that calls `tabletop-cli generate client-sdk`.

**Step 8: Run focused tests and verify green**

Run:

```bash
bun test --cwd examples/splendor/engine
bun test --cwd examples/splendor/terminal
```

Expected: PASS.

**Step 9: Commit**

```bash
git add examples/splendor/engine examples/splendor/terminal
git commit -m "refactor: migrate splendor to discovery steps"
```

## Task 6: Remove Legacy Discovery References And Run Full Verification

**Files:**

- Modify any remaining files found by search.
- Test all affected packages.

**Step 1: Search for legacy API**

Run:

```bash
rg -n "discoverySchema|discover\\(|\\.discoverable\\(\\{|metadata\\?: Record<string, unknown>|GameClientSdk" packages examples docs/design/2026-04-22-step-authored-discovery-api-design.md docs/plans/2026-04-22-step-authored-discovery-api-implementation.md
```

Expected:

- no production/test usage of legacy `.discoverable({ discoverySchema, discover })`
- no command descriptor usage of `discoverySchema`
- no generated SDK fake `GameClientSdk`
- docs may mention legacy only as removed design context

**Step 2: Fix remaining references**

Update any remaining implementation or tests to the step-authored model.

**Step 3: Run full verification**

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

Expected: PASS.

**Step 4: Commit final cleanup**

```bash
git add .
git commit -m "chore: remove legacy discovery api references"
```

If there are no changes after verification, skip this commit.

## Expected Implementation Gaps To Report If Encountered

Report any deviation from the design, especially:

- TypeScript cannot precisely infer per-step `nextInput` from ordered steps.
- CLI type rendering cannot preserve named schema aliases and emits inline object types instead.
- AsyncAPI schema generation cannot express some per-step result union precisely.
- Splendor commands need more UI output fields than the current state/data model exposes cleanly.
