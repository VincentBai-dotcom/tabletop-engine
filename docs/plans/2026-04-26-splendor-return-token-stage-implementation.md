# Splendor Return-Token Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Splendor's "return tokens when over 10" rule out of the four token-granting commands (`take_three_distinct_gems`, `take_two_same_gems`, `reserve_face_up_card`, `reserve_deck_card`) and into a dedicated `return_tokens` command hosted by a new `returnExcessiveTokens` single-active-player stage that the `playerTurn` transition routes to whenever the actor ends a command at more than 10 tokens.

**Architecture:** The four existing commands stop carrying any return-token logic in their schemas, discoveries, validators, and executors — they just take or reserve. After they execute, `playerTurn`'s transition checks the actor's `getRequiredReturnCount()`. If it is greater than zero, the engine moves into a new `returnExcessiveTokens` stage whose only available command is `return_tokens`; that command discovers/validates/executes against the player's actual tokens and the same `createReturnTokenDiscovery` helper used today. Once the player has returned the required count, the stage transitions into `checkVictoryCondition`, rejoining the existing turn-end pipeline. No buy command can cause overflow, so the transition only adds an overflow branch, never replaces existing routes.

**Tech Stack:** TypeScript, Bun tests, tabletop-engine command/stage builder factories, existing `createReturnTokenDiscovery` helper, Splendor `SplendorPlayerState` / `TokenCountsState` facades.

---

## Naming Decisions

Use these names consistently in code:

- New command id: `return_tokens`
- New stage id: `returnExcessiveTokens`
- New discovery step id reuses the existing constant `SPLENDOR_DISCOVERY_STEPS.selectReturnToken` (the value `"select_return_token"`) — the new command becomes the only place this step lives once the source commands stop using it.
- New event type: `tokens_returned`
- Event payload shape: `{ actorId: string; returnTokens: ReturnTokensPayload }`
- Validation reasons:
  - `not_in_overflow` — `return_tokens` invoked when the player owes zero returns
  - `invalid_return_tokens` — proposed returns do not match required count or are not owned (reuses the existing reason from the old code path)

---

### Task 1: Add `return_tokens` Command

**Files:**

- Create: `examples/splendor/engine/src/commands/return-tokens.ts`
- Modify: `examples/splendor/engine/src/commands/index.ts`
- Test: `examples/splendor/engine/tests/game.test.ts`

**Step 1: Write failing structural test for the new command**

Append to `examples/splendor/engine/tests/game.test.ts`:

```ts
test("splendor return_tokens command declares the select_return_token discovery step", () => {
  const commands = createCommands();
  const returnTokens = commands.find(
    (command) => command.commandId === "return_tokens",
  );

  expect(returnTokens).toBeDefined();
  expect(returnTokens?.discovery).toMatchObject({
    startStep: SPLENDOR_DISCOVERY_STEPS.selectReturnToken,
  });
  expect(returnTokens?.discovery?.steps).toHaveLength(1);
  expect(returnTokens?.discovery?.steps[0]).toMatchObject({
    stepId: SPLENDOR_DISCOVERY_STEPS.selectReturnToken,
  });
});
```

**Step 2: Write failing isAvailable + execute tests**

Add to the same test file:

```ts
test("return_tokens is unavailable to a player without overflow", () => {
  const { gameExecutor, state } = createTestInitialState(["p1", "p2"]);

  expect(
    gameExecutor.listAvailableCommands(state, { actorId: "p1" }),
  ).not.toContain("return_tokens");
});

test("return_tokens executes against the player's current overflow", () => {
  const { gameExecutor, state } = createTestInitialState(["p1", "p2"]);

  state.game.players.p1!.tokens.white = 6;
  state.game.players.p1!.tokens.blue = 6;

  const result = gameExecutor.executeCommand(state, {
    type: "return_tokens",
    actorId: "p1",
    input: {
      returnTokens: { white: 1, blue: 1 },
    },
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected return_tokens to succeed");
  }
  expect(result.state.game.players.p1?.tokens).toMatchObject({
    white: 5,
    blue: 5,
  });
  expect(result.state.game.bank.white).toBe(5);
  expect(result.state.game.bank.blue).toBe(5);
  expect(result.events.map((event) => event.type)).toContain("tokens_returned");
});
```

The first test will fail because `return_tokens` does not exist; both runtime tests will then fail in subsequent steps.

**Step 3: Run tests to verify failure**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: FAIL — `commands.find(...)` returns undefined for `return_tokens`; `executeCommand` rejects unknown command type.

**Step 4: Implement the new command**

Create `examples/splendor/engine/src/commands/return-tokens.ts`:

```ts
import { t } from "tabletop-engine";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import {
  defineSplendorCommand,
  guardedAvailability,
  guardedValidate,
} from "./shared.ts";

const returnTokensCommandSchema = t.object({
  returnTokens: t.record(t.string(), t.number()),
});

export type ReturnTokensInput = typeof returnTokensCommandSchema.static;

const selectReturnTokenDiscoveryInputSchema = t.object({
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

const selectReturnTokenDiscoveryOutputSchema = t.object({
  color: t.string(),
  selectedCount: t.number(),
  requiredReturnCount: t.number(),
});

const returnTokensCommand = defineSplendorCommand({
  commandId: "return_tokens",
  commandSchema: returnTokensCommandSchema,
})
  .discoverable((step) => [
    step("select_return_token")
      .initial()
      .input(selectReturnTokenDiscoveryInputSchema)
      .output(selectReturnTokenDiscoveryOutputSchema)
      .resolve(({ actorId, game, discovery }) => {
        const draft = discovery.input;
        const player = game.getPlayer(actorId);
        const requiredReturnCount = player.getRequiredReturnCount();
        const returnDiscovery = createReturnTokenDiscovery(
          draft,
          player.tokens,
          requiredReturnCount,
        );

        return (
          returnDiscovery ??
          completeDiscovery({
            returnTokens: draft.returnTokens ?? {},
          })
        );
      })
      .build(),
  ])
  .isAvailable((context) => {
    return guardedAvailability(() => {
      const player = context.game.getPlayer(context.actorId);

      return player.getRequiredReturnCount() > 0;
    });
  })
  .validate(({ game, command }) => {
    return guardedValidate(() => {
      const player = game.getPlayer(command.actorId);
      const requiredReturnCount = player.getRequiredReturnCount();

      if (requiredReturnCount === 0) {
        return { ok: false, reason: "not_in_overflow" };
      }

      if (
        !player.canReturnTokens(command.input.returnTokens, requiredReturnCount)
      ) {
        return { ok: false, reason: "invalid_return_tokens" };
      }

      return { ok: true };
    });
  })
  .execute(({ game, command, emitEvent }) => {
    const player = game.getPlayer(command.actorId);

    player.returnTokensTo(game.bank, command.input.returnTokens);
    emitEvent({
      category: "domain",
      type: "tokens_returned",
      payload: {
        actorId: command.actorId,
        returnTokens: command.input.returnTokens,
      },
    });
  })
  .build();

export { returnTokensCommand };
```

**Step 5: Register the new command**

Modify `examples/splendor/engine/src/commands/index.ts` so the engine is aware of it. The new command is **not** yet added to the player-turn `createCommands()` list (it belongs to the new stage, see Task 2). Export the type:

```ts
import { buyFaceUpCardCommand } from "./buy-face-up-card.ts";
import { buyReservedCardCommand } from "./buy-reserved-card.ts";
import { chooseNobleCommand } from "./choose-noble.ts";
import { reserveDeckCardCommand } from "./reserve-deck-card.ts";
import { reserveFaceUpCardCommand } from "./reserve-face-up-card.ts";
import { returnTokensCommand } from "./return-tokens.ts";
import { takeThreeDistinctGemsCommand } from "./take-three-distinct-gems.ts";
import { takeTwoSameGemsCommand } from "./take-two-same-gems.ts";
import type { SplendorCommand } from "./shared.ts";

export function createCommands(): SplendorCommand[] {
  return [
    takeThreeDistinctGemsCommand,
    takeTwoSameGemsCommand,
    reserveFaceUpCardCommand,
    reserveDeckCardCommand,
    buyFaceUpCardCommand,
    buyReservedCardCommand,
  ];
}

export { chooseNobleCommand, returnTokensCommand };

export type { BuyFaceUpCardInput } from "./buy-face-up-card.ts";
export type { BuyReservedCardInput } from "./buy-reserved-card.ts";
export type { ChooseNobleInput } from "./choose-noble.ts";
export type { ReserveDeckCardInput } from "./reserve-deck-card.ts";
export type { ReserveFaceUpCardInput } from "./reserve-face-up-card.ts";
export type { ReturnTokensInput } from "./return-tokens.ts";
export type { TakeThreeDistinctGemsInput } from "./take-three-distinct-gems.ts";
export type { TakeTwoSameGemsInput } from "./take-two-same-gems.ts";
```

**Step 6: Run tests to verify they pass**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: the three new tests pass. The "splendor exposes the expected available command families" test still passes because `return_tokens` is not registered in `createCommands()`.

Also run typecheck: `bun run --cwd examples/splendor/engine typecheck` (if such a script exists; otherwise `bunx tsc -p examples/splendor/engine --noEmit`).

**Step 7: Commit**

```bash
git add .
git commit -m "feat(splendor): add return_tokens command"
```

### Task 2: Add `returnExcessiveTokens` Stage

**Files:**

- Create: `examples/splendor/engine/src/stages/return-excessive-tokens.ts`
- Modify: `examples/splendor/engine/src/stages/index.ts`
- Test: `examples/splendor/engine/tests/game.test.ts`

**Step 1: Write failing test for the stage's wiring**

Append to `examples/splendor/engine/tests/game.test.ts`:

```ts
test("returnExcessiveTokens stage exposes only return_tokens to the active player", () => {
  const { gameExecutor, state } = createTestInitialState(["p1", "p2"]);

  state.game.players.p1!.tokens.white = 6;
  state.game.players.p1!.tokens.blue = 6;
  state.runtime.progression.currentStage = {
    id: "returnExcessiveTokens",
    kind: "activePlayer",
    activePlayerId: "p1",
  };

  expect(gameExecutor.listAvailableCommands(state, { actorId: "p1" })).toEqual([
    "return_tokens",
  ]);
});
```

**Step 2: Run tests to verify failure**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: FAIL — `returnExcessiveTokens` is not a known stage id; the engine throws on stage lookup or returns an empty available-command list.

**Step 3: Create the stage definition**

Create `examples/splendor/engine/src/stages/return-excessive-tokens.ts`:

```ts
import type {
  AutomaticStageDefinition,
  SingleActivePlayerStageDefinition,
  StageFactory,
} from "tabletop-engine";
import { returnTokensCommand } from "../commands/index.ts";
import type { SplendorGameState } from "../state.ts";
import { getLastActingPlayerId } from "./shared.ts";

interface CreateReturnExcessiveTokensStageOptions {
  defineStage: StageFactory<SplendorGameState>;
  getCheckVictoryConditionStage: () => AutomaticStageDefinition<SplendorGameState>;
}

export function createReturnExcessiveTokensStage({
  defineStage,
  getCheckVictoryConditionStage,
}: CreateReturnExcessiveTokensStageOptions): SingleActivePlayerStageDefinition<SplendorGameState> {
  return defineStage("returnExcessiveTokens")
    .singleActivePlayer()
    .activePlayer(({ runtime }) => {
      return getLastActingPlayerId(runtime);
    })
    .commands([returnTokensCommand])
    .nextStages(() => ({
      checkVictoryConditionStage: getCheckVictoryConditionStage(),
    }))
    .transition(({ nextStages }) => {
      return nextStages.checkVictoryConditionStage;
    })
    .build();
}
```

**Step 4: Wire the stage into `createSplendorStages`**

Modify `examples/splendor/engine/src/stages/index.ts` to construct the new stage and pass a getter to `createPlayerTurnStage`:

```ts
import {
  createStageFactory,
  type SingleActivePlayerStageDefinition,
} from "tabletop-engine";
import { createCommands } from "../commands/index.ts";
import type { SplendorGameState } from "../state.ts";
import { createCheckVictoryConditionStage } from "./check-victory-condition.ts";
import { createChooseNobleStage } from "./choose-noble.ts";
import { createGameEndStage } from "./game-end.ts";
import { createPlayerTurnStage } from "./player-turn.ts";
import { createResolveNobleStage } from "./resolve-noble.ts";
import { createReturnExcessiveTokensStage } from "./return-excessive-tokens.ts";

export interface SplendorStages {
  initialStage: SingleActivePlayerStageDefinition<SplendorGameState>;
}

export function createSplendorStages(): SplendorStages {
  const defineStage = createStageFactory<SplendorGameState>();
  const commands = createCommands();

  const gameEndStage = createGameEndStage({
    defineStage,
  });

  const chooseNobleStage = createChooseNobleStage({
    defineStage,
    getCheckVictoryConditionStage: () => checkVictoryConditionStage,
  });

  const resolveNobleStage = createResolveNobleStage({
    defineStage,
    getChooseNobleStage: () => chooseNobleStage,
    getCheckVictoryConditionStage: () => checkVictoryConditionStage,
  });

  const checkVictoryConditionStage = createCheckVictoryConditionStage({
    defineStage,
    getGameEndStage: () => gameEndStage,
    getPlayerTurnStage: () => playerTurnStage,
  });

  const returnExcessiveTokensStage = createReturnExcessiveTokensStage({
    defineStage,
    getCheckVictoryConditionStage: () => checkVictoryConditionStage,
  });

  const playerTurnStage = createPlayerTurnStage({
    defineStage,
    commands,
    getResolveNobleStage: () => resolveNobleStage,
    getCheckVictoryConditionStage: () => checkVictoryConditionStage,
    getReturnExcessiveTokensStage: () => returnExcessiveTokensStage,
  });

  return {
    initialStage: playerTurnStage,
  };
}
```

Note: `createPlayerTurnStage` does not yet accept `getReturnExcessiveTokensStage`. Adding it is part of Task 3, so this step's diff to `index.ts` will fail typechecking until then. To keep the commit boundary clean, postpone adding the new getter until Task 3; for now wire `returnExcessiveTokensStage` only in the local scope and add it to the player-turn factory in Task 3. The simpler interim form for this commit is:

```ts
const returnExcessiveTokensStage = createReturnExcessiveTokensStage({
  defineStage,
  getCheckVictoryConditionStage: () => checkVictoryConditionStage,
});

const playerTurnStage = createPlayerTurnStage({
  defineStage,
  commands,
  getResolveNobleStage: () => resolveNobleStage,
  getCheckVictoryConditionStage: () => checkVictoryConditionStage,
});

// Reference the new stage so its registration is reachable.
void returnExcessiveTokensStage;
```

This is intentionally awkward; Task 3 finishes the wiring in a single follow-up commit so the stage becomes reachable from the player-turn transition.

**Step 5: Run tests to verify they pass**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: PASS for the new test. Earlier tests still pass.

**Step 6: Commit**

```bash
git add .
git commit -m "feat(splendor): add returnExcessiveTokens stage"
```

### Task 3: Route Player-Turn Transition Through Overflow

**Files:**

- Modify: `examples/splendor/engine/src/stages/player-turn.ts`
- Modify: `examples/splendor/engine/src/stages/index.ts`
- Test: `examples/splendor/engine/tests/game.test.ts`

**Step 1: Write failing integration test for overflow routing**

Append to `examples/splendor/engine/tests/game.test.ts`:

```ts
test("taking gems with overflow transitions into returnExcessiveTokens", () => {
  const { gameExecutor, state } = createTestInitialState(["p1", "p2"]);

  state.game.players.p1!.tokens.white = 4;
  state.game.players.p1!.tokens.blue = 4;
  state.game.bank.white = 4;
  state.game.bank.blue = 4;
  state.game.bank.green = 4;

  const result = gameExecutor.executeCommand(state, {
    type: "take_three_distinct_gems",
    actorId: "p1",
    input: {
      colors: ["white", "blue", "green"],
    },
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected take_three to succeed");
  }
  expect(result.state.runtime.progression.currentStage).toEqual({
    id: "returnExcessiveTokens",
    kind: "activePlayer",
    activePlayerId: "p1",
  });
});
```

This will compile only after Task 1's commit applies the new stage id; both prior tasks are merged before this one begins.

**Step 2: Run test to verify failure**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: FAIL — `currentStage` is `playerTurn` for `p2` because the existing transition still routes to `checkVictoryCondition`. (The take command currently still also handles return tokens; without `input.returnTokens` it would normally reject the command. To keep this test against the partially-migrated state, the take commands keep their old return logic until later tasks. The current take command rejects when overflow without a return; mock around this by also setting the bank low so overflow occurs even with returnTokens=undefined: actually validate require canReturnTokens which calls totalCount === requiredReturnCount=0 path. With p1 at 8 tokens before and taking 3 distinct, p1 lands at 11 → required 1 → canReturn(undefined, 1) sums to 0 ≠ 1 → fails. So the existing validate WILL reject. Adjust the test to use a setup that does not exceed 10 OR temporarily expects the old failure mode. Better path: defer this test's player count until Task 4 strips the take command's return constraint, then this test passes. Therefore, write the test as part of Task 4 instead; this Task 3 stays mechanical and only adds the transition wiring + a unit-style stage transition test.)

Replace the integration test with this lower-level transition unit test that does not depend on validate logic:

```ts
test("playerTurn transition exposes a returnExcessiveTokens branch", () => {
  const game = createSplendorGame();
  const playerTurn = game.stages.playerTurn;

  if (!playerTurn || playerTurn.kind !== "activePlayer") {
    throw new Error("expected playerTurn active-player stage");
  }
  const nextStages = playerTurn.nextStages?.() ?? {};

  expect(Object.keys(nextStages)).toContain("returnExcessiveTokensStage");
});
```

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: FAIL — the player-turn factory does not yet pass a `returnExcessiveTokensStage` getter into its `nextStages`.

**Step 3: Update `createPlayerTurnStage` to accept and route through the new stage**

Modify `examples/splendor/engine/src/stages/player-turn.ts`:

```ts
import type {
  AutomaticStageDefinition,
  DefinedCommand,
  SingleActivePlayerStageDefinition,
  StageFactory,
} from "tabletop-engine";
import type { SplendorGameState } from "../state.ts";
import { getLastActingPlayerId } from "./shared.ts";

interface CreatePlayerTurnStageOptions {
  defineStage: StageFactory<SplendorGameState>;
  commands: readonly DefinedCommand<SplendorGameState>[];
  getResolveNobleStage: () => AutomaticStageDefinition<SplendorGameState>;
  getCheckVictoryConditionStage: () => AutomaticStageDefinition<SplendorGameState>;
  getReturnExcessiveTokensStage: () => SingleActivePlayerStageDefinition<SplendorGameState>;
}

export function createPlayerTurnStage({
  defineStage,
  commands,
  getResolveNobleStage,
  getCheckVictoryConditionStage,
  getReturnExcessiveTokensStage,
}: CreatePlayerTurnStageOptions): SingleActivePlayerStageDefinition<SplendorGameState> {
  return defineStage("playerTurn")
    .singleActivePlayer()
    .activePlayer(({ game, runtime }) => {
      const previousActorId = runtime.progression.lastActingStage
        ? getLastActingPlayerId(runtime)
        : null;

      return previousActorId
        ? game.getNextPlayerId(previousActorId)
        : game.playerOrder[0]!;
    })
    .commands(commands)
    .nextStages(() => ({
      resolveNobleStage: getResolveNobleStage(),
      checkVictoryConditionStage: getCheckVictoryConditionStage(),
      returnExcessiveTokensStage: getReturnExcessiveTokensStage(),
    }))
    .transition(({ game, command, nextStages }) => {
      const actor = game.getPlayer(command.actorId);

      if (actor.getRequiredReturnCount() > 0) {
        return nextStages.returnExcessiveTokensStage;
      }

      return command.type === "buy_face_up_card" ||
        command.type === "buy_reserved_card"
        ? nextStages.resolveNobleStage
        : nextStages.checkVictoryConditionStage;
    })
    .build();
}
```

**Step 4: Pass the getter in `createSplendorStages`**

Modify `examples/splendor/engine/src/stages/index.ts` — drop the placeholder `void returnExcessiveTokensStage;` and inject the getter:

```ts
const playerTurnStage = createPlayerTurnStage({
  defineStage,
  commands,
  getResolveNobleStage: () => resolveNobleStage,
  getCheckVictoryConditionStage: () => checkVictoryConditionStage,
  getReturnExcessiveTokensStage: () => returnExcessiveTokensStage,
});
```

**Step 5: Run tests to verify they pass**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: PASS for the new transition wiring test and all earlier tests. The take-command integration tests (e.g. line 347 in `game.test.ts`) still pass because the existing commands continue to handle return logic and clear the overflow before the transition runs.

**Step 6: Commit**

```bash
git add .
git commit -m "feat(splendor): route playerTurn through returnExcessiveTokens"
```

### Task 4: Strip Return Logic From `take_three_distinct_gems`

**Files:**

- Modify: `examples/splendor/engine/src/commands/take-three-distinct-gems.ts`
- Modify: `examples/splendor/engine/tests/game.test.ts`

**Step 1: Update the existing structural assertion**

The test at `examples/splendor/engine/tests/game.test.ts:187` (`splendor commands declare step-authored discovery flows`) currently asserts the take-three discovery has two steps. Change that block to expect a single `select_gem_color` step:

```ts
expect(takeThreeDistinctGems?.discovery?.steps).toHaveLength(1);
expect(takeThreeDistinctGems?.discovery?.steps[0]).toMatchObject({
  stepId: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
});
```

**Step 2: Add a failing test for overflow routing through the new stage**

Append to `examples/splendor/engine/tests/game.test.ts`:

```ts
test("taking three distinct gems with overflow lands the actor in returnExcessiveTokens", () => {
  const { gameExecutor, state } = createTestInitialState(["p1", "p2"]);

  state.game.players.p1!.tokens.white = 4;
  state.game.players.p1!.tokens.blue = 4;

  const result = gameExecutor.executeCommand(state, {
    type: "take_three_distinct_gems",
    actorId: "p1",
    input: {
      colors: ["white", "blue", "green"],
    },
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected take_three to succeed");
  }
  expect(result.state.game.players.p1?.tokens).toMatchObject({
    white: 5,
    blue: 5,
    green: 1,
  });
  expect(result.state.runtime.progression.currentStage).toEqual({
    id: "returnExcessiveTokens",
    kind: "activePlayer",
    activePlayerId: "p1",
  });
});
```

**Step 3: Run tests to verify failure**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: FAIL — the discovery still has two steps (the structural assertion change makes the existing test fail), and the overflow scenario fails because the existing validate rejects the take when `canReturnTokens(undefined, 1) === false`.

**Step 4: Rewrite `take-three-distinct-gems.ts` without return-token logic**

Replace the whole file with:

```ts
import { t } from "tabletop-engine";
import { completeDiscovery, SPLENDOR_DISCOVERY_STEPS } from "../discovery.ts";
import {
  assertGemTokenColor,
  guardedAvailability,
  guardedValidate,
  isGemTokenColor,
  defineSplendorCommand,
} from "./shared.ts";

const takeThreeDistinctGemsCommandSchema = t.object({
  colors: t.array(t.string()),
});

export type TakeThreeDistinctGemsInput =
  typeof takeThreeDistinctGemsCommandSchema.static;

const selectGemColorDiscoveryInputSchema = t.object({
  selectedColors: t.optional(t.array(t.string())),
});

const selectGemColorDiscoveryOutputSchema = t.object({
  color: t.string(),
  selectedCount: t.number(),
  requiredCount: t.number(),
});

const takeThreeDistinctGemsCommand = defineSplendorCommand({
  commandId: "take_three_distinct_gems",
  commandSchema: takeThreeDistinctGemsCommandSchema,
})
  .discoverable((step) => [
    step("select_gem_color")
      .initial()
      .input(selectGemColorDiscoveryInputSchema)
      .output(selectGemColorDiscoveryOutputSchema)
      .resolve(({ game, discovery }) => {
        const draft = discovery.input;
        const selectedColors = draft.selectedColors ?? [];

        if (selectedColors.length >= 3) {
          return completeDiscovery({ colors: selectedColors });
        }

        const bankEntries = Object.entries(game.bank) as Array<
          [string, number]
        >;

        return bankEntries
          .filter(
            ([color, count]) =>
              color !== "gold" && count > 0 && !selectedColors.includes(color),
          )
          .map(([color]) => ({
            id: color,
            output: {
              color,
              selectedCount: selectedColors.length + 1,
              requiredCount: 3,
            },
            nextInput: {
              selectedColors: [...selectedColors, color],
            },
            nextStep: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
          }));
      })
      .build(),
  ])
  .isAvailable((context) => {
    return guardedAvailability(() => {
      const game = context.game;
      const bankEntries = Object.entries(game.bank) as Array<[string, number]>;

      return (
        bankEntries.filter(([color, count]) => color !== "gold" && count > 0)
          .length >= 3
      );
    });
  })
  .validate(({ game, command }) => {
    return guardedValidate(() => {
      const input = command.input;

      if (input.colors.length !== 3) {
        return { ok: false, reason: "three_colors_required" };
      }

      const colors = input.colors;

      if (!colors.every((color) => isGemTokenColor(color))) {
        return { ok: false, reason: "invalid_color" };
      }

      const uniqueColors = new Set(colors);

      if (uniqueColors.size !== 3) {
        return { ok: false, reason: "colors_must_be_distinct" };
      }

      for (const color of colors) {
        if (game.bank[color] <= 0) {
          return { ok: false, reason: "token_color_unavailable" };
        }
      }

      return { ok: true };
    });
  })
  .execute(({ game, command, emitEvent }) => {
    const actorId = command.actorId;
    const input = command.input;
    const colors = input.colors;

    if (!colors.every((color) => isGemTokenColor(color))) {
      throw new Error("invalid_color");
    }

    const player = game.getPlayer(actorId);

    for (const rawColor of colors) {
      const color = assertGemTokenColor(rawColor);
      game.bank.adjustColor(color, -1);
      player.tokens.adjustColor(color, 1);
    }

    emitEvent({
      category: "domain",
      type: "gems_taken",
      payload: {
        actorId,
        colors,
      },
    });
  })
  .build();

export { takeThreeDistinctGemsCommand };
```

**Step 5: Run tests to verify they pass**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: PASS for the new overflow test; the existing "taking three distinct gems updates tokens and advances the turn" test still passes because that scenario does not overflow, and `gems_taken` event payload omits `returnTokens` — update the test if it still asserts `returnTokens` (it currently does not).

**Step 6: Commit**

```bash
git add .
git commit -m "refactor(splendor): take_three_distinct_gems delegates returns to stage"
```

### Task 5: Strip Return Logic From `take_two_same_gems`

**Files:**

- Modify: `examples/splendor/engine/src/commands/take-two-same-gems.ts`
- Modify: `examples/splendor/engine/tests/game.test.ts`

**Step 1: Add a failing overflow test for the two-same-gems path**

Append to `examples/splendor/engine/tests/game.test.ts`:

```ts
test("taking two same gems with overflow lands the actor in returnExcessiveTokens", () => {
  const { gameExecutor, state } = createTestInitialState(["p1", "p2"]);

  state.game.players.p1!.tokens.white = 9;
  state.game.bank.white = 4;

  const result = gameExecutor.executeCommand(state, {
    type: "take_two_same_gems",
    actorId: "p1",
    input: {
      color: "white",
    },
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected take_two to succeed");
  }
  expect(result.state.game.players.p1?.tokens.white).toBe(11);
  expect(result.state.runtime.progression.currentStage).toEqual({
    id: "returnExcessiveTokens",
    kind: "activePlayer",
    activePlayerId: "p1",
  });
});
```

**Step 2: Run tests to verify failure**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: FAIL — existing validate rejects the take because `canReturnTokens(undefined, 1)` is false.

**Step 3: Rewrite `take-two-same-gems.ts` without return-token logic**

Replace the whole file with:

```ts
import { t } from "tabletop-engine";
import { completeDiscovery, SPLENDOR_DISCOVERY_STEPS } from "../discovery.ts";
import {
  assertGemTokenColor,
  guardedAvailability,
  guardedValidate,
  isGemTokenColor,
  defineSplendorCommand,
} from "./shared.ts";

const takeTwoSameGemsCommandSchema = t.object({
  color: t.string(),
});

export type TakeTwoSameGemsInput = typeof takeTwoSameGemsCommandSchema.static;

const selectGemColorDiscoveryInputSchema = t.object({
  selectedColor: t.optional(t.string()),
});

const selectGemColorDiscoveryOutputSchema = t.object({
  color: t.string(),
  amount: t.number(),
});

const takeTwoSameGemsCommand = defineSplendorCommand({
  commandId: "take_two_same_gems",
  commandSchema: takeTwoSameGemsCommandSchema,
})
  .discoverable((step) => [
    step("select_gem_color")
      .initial()
      .input(selectGemColorDiscoveryInputSchema)
      .output(selectGemColorDiscoveryOutputSchema)
      .resolve(({ game, discovery }) => {
        const draft = discovery.input;

        if (draft.selectedColor) {
          return completeDiscovery({ color: draft.selectedColor });
        }

        const bankEntries = Object.entries(game.bank) as Array<
          [string, number]
        >;

        return bankEntries
          .filter(([color, count]) => color !== "gold" && count >= 4)
          .map(([color]) => ({
            id: color,
            output: {
              color,
              amount: 2,
            },
            nextInput: {
              selectedColor: color,
            },
            nextStep: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
          }));
      })
      .build(),
  ])
  .isAvailable((context) => {
    return guardedAvailability(() => {
      const game = context.game;
      const bankEntries = Object.entries(game.bank) as Array<[string, number]>;

      return bankEntries.some(
        ([color, count]) => color !== "gold" && count >= 4,
      );
    });
  })
  .validate(({ game, command }) => {
    return guardedValidate(() => {
      const input = command.input;

      const color = input.color;

      if (!isGemTokenColor(color)) {
        return { ok: false, reason: "invalid_color" };
      }

      if (game.bank[color] < 4) {
        return { ok: false, reason: "not_enough_tokens_for_double_take" };
      }

      return { ok: true };
    });
  })
  .execute(({ game, command, emitEvent }) => {
    const actorId = command.actorId;
    const input = command.input;
    const color = assertGemTokenColor(input.color);
    const player = game.getPlayer(actorId);

    game.bank.adjustColor(color, -2);
    player.tokens.adjustColor(color, 2);
    emitEvent({
      category: "domain",
      type: "double_gem_taken",
      payload: {
        actorId,
        color,
      },
    });
  })
  .build();

export { takeTwoSameGemsCommand };
```

**Step 4: Run tests to verify they pass**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: PASS for the new test and all existing tests.

**Step 5: Commit**

```bash
git add .
git commit -m "refactor(splendor): take_two_same_gems delegates returns to stage"
```

### Task 6: Strip Return Logic From `reserve_deck_card`

**Files:**

- Modify: `examples/splendor/engine/src/commands/reserve-deck-card.ts`
- Modify: `examples/splendor/engine/tests/game.test.ts`

**Step 1: Add a failing overflow test for the reserve-deck path**

Append to `examples/splendor/engine/tests/game.test.ts`:

```ts
test("reserving a deck card with overflow lands the actor in returnExcessiveTokens", () => {
  const { gameExecutor, state } = createTestInitialState(["p1", "p2"]);

  state.game.players.p1!.tokens.white = 10;

  const result = gameExecutor.executeCommand(state, {
    type: "reserve_deck_card",
    actorId: "p1",
    input: {
      level: 1,
    },
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected reserve_deck_card to succeed");
  }
  expect(result.state.game.players.p1?.tokens.gold).toBe(1);
  expect(result.state.runtime.progression.currentStage).toEqual({
    id: "returnExcessiveTokens",
    kind: "activePlayer",
    activePlayerId: "p1",
  });
});
```

**Step 2: Run tests to verify failure**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: FAIL — existing validate rejects when overflow returns are not provided in `input`.

**Step 3: Rewrite `reserve-deck-card.ts` without return-token logic**

Replace the whole file with:

```ts
import { t } from "tabletop-engine";
import { completeDiscovery, SPLENDOR_DISCOVERY_STEPS } from "../discovery.ts";
import {
  assertDevelopmentLevel,
  guardedAvailability,
  guardedValidate,
  isDevelopmentLevel,
  defineSplendorCommand,
} from "./shared.ts";

const reserveDeckCardCommandSchema = t.object({
  level: t.number(),
});

export type ReserveDeckCardInput = typeof reserveDeckCardCommandSchema.static;

const selectDeckLevelDiscoveryInputSchema = t.object({
  selectedLevel: t.optional(t.number()),
});

const selectDeckLevelDiscoveryOutputSchema = t.object({
  level: t.number(),
  cardCount: t.number(),
  source: t.string(),
});

const reserveDeckCardCommand = defineSplendorCommand({
  commandId: "reserve_deck_card",
  commandSchema: reserveDeckCardCommandSchema,
})
  .discoverable((step) => [
    step("select_deck_level")
      .initial()
      .input(selectDeckLevelDiscoveryInputSchema)
      .output(selectDeckLevelDiscoveryOutputSchema)
      .resolve(({ game, discovery }) => {
        const draft = discovery.input;
        const deckEntries = Object.entries(game.board.deckByLevel) as Array<
          [string, number[]]
        >;

        if (draft.selectedLevel) {
          return completeDiscovery({ level: draft.selectedLevel });
        }

        return deckEntries
          .filter(([, cardIds]) => cardIds.length > 0)
          .map(([level, cardIds]) => ({
            id: level,
            output: {
              level: Number(level),
              cardCount: cardIds.length,
              source: "deck",
            },
            nextInput: {
              selectedLevel: Number(level),
            },
            nextStep: SPLENDOR_DISCOVERY_STEPS.selectDeckLevel,
          }));
      })
      .build(),
  ])
  .isAvailable((context) => {
    return guardedAvailability(() => {
      const actorId = context.actorId;
      const game = context.game;
      const player = game.getPlayer(actorId);
      const decks = Object.values(game.board.deckByLevel) as number[][];

      if (!player.canReserveMoreCards()) {
        return false;
      }

      return decks.some((cards) => cards.length > 0);
    });
  })
  .validate(({ game, command }) => {
    return guardedValidate(() => {
      const actorId = command.actorId;
      const input = command.input;
      const player = game.getPlayer(actorId);

      if (!player.canReserveMoreCards()) {
        return { ok: false, reason: "reserved_limit_reached" };
      }

      const level = input.level;

      if (!isDevelopmentLevel(level)) {
        return { ok: false, reason: "invalid_level" };
      }

      if (game.board.deckByLevel[level].length === 0) {
        return { ok: false, reason: "deck_empty" };
      }

      return { ok: true };
    });
  })
  .execute(({ game, command, emitEvent }) => {
    const actorId = command.actorId;
    const input = command.input;
    const level = assertDevelopmentLevel(input.level);
    const player = game.getPlayer(actorId);
    const reservedCardId = game.board.reserveDeckCard(level);

    player.reserveCard(reservedCardId);
    const receivedGold = player.gainGoldFrom(game.bank);
    emitEvent({
      category: "domain",
      type: "card_reserved",
      payload: {
        actorId,
        source: "deck",
        level,
        cardId: reservedCardId,
        receivedGold,
      },
    });
  })
  .build();

export { reserveDeckCardCommand };
```

**Step 4: Run tests to verify they pass**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add .
git commit -m "refactor(splendor): reserve_deck_card delegates returns to stage"
```

### Task 7: Strip Return Logic From `reserve_face_up_card`

**Files:**

- Modify: `examples/splendor/engine/src/commands/reserve-face-up-card.ts`
- Modify: `examples/splendor/engine/tests/game.test.ts`

**Step 1: Add a failing overflow test for the reserve-face-up path**

Append to `examples/splendor/engine/tests/game.test.ts`:

```ts
test("reserving a face-up card with overflow lands the actor in returnExcessiveTokens", () => {
  const { gameExecutor, state } = createTestInitialState(["p1", "p2"]);

  state.game.players.p1!.tokens.white = 10;
  const targetCardId = state.game.board.faceUpByLevel[1]![0]!;

  const result = gameExecutor.executeCommand(state, {
    type: "reserve_face_up_card",
    actorId: "p1",
    input: {
      level: 1,
      cardId: targetCardId,
    },
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected reserve_face_up_card to succeed");
  }
  expect(result.state.runtime.progression.currentStage).toEqual({
    id: "returnExcessiveTokens",
    kind: "activePlayer",
    activePlayerId: "p1",
  });
});
```

**Step 2: Run tests to verify failure**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: FAIL — same reason: validate rejects without input.returnTokens.

**Step 3: Rewrite `reserve-face-up-card.ts` without return-token logic**

Replace the whole file with:

```ts
import { t } from "tabletop-engine";
import { completeDiscovery, SPLENDOR_DISCOVERY_STEPS } from "../discovery.ts";
import {
  assertDevelopmentLevel,
  guardedAvailability,
  guardedValidate,
  isDevelopmentLevel,
  defineSplendorCommand,
} from "./shared.ts";

const reserveFaceUpCardCommandSchema = t.object({
  level: t.number(),
  cardId: t.number(),
});

export type ReserveFaceUpCardInput =
  typeof reserveFaceUpCardCommandSchema.static;

const selectFaceUpCardDiscoveryInputSchema = t.object({
  selectedLevel: t.optional(t.number()),
  selectedCardId: t.optional(t.number()),
});

const selectFaceUpCardDiscoveryOutputSchema = t.object({
  level: t.number(),
  cardId: t.number(),
  bonusColor: t.string(),
  prestigePoints: t.number(),
  source: t.string(),
});

const reserveFaceUpCardCommand = defineSplendorCommand({
  commandId: "reserve_face_up_card",
  commandSchema: reserveFaceUpCardCommandSchema,
})
  .discoverable((step) => [
    step("select_face_up_card")
      .initial()
      .input(selectFaceUpCardDiscoveryInputSchema)
      .output(selectFaceUpCardDiscoveryOutputSchema)
      .resolve(({ game, discovery }) => {
        const draft = discovery.input;
        const faceUpEntries = Object.entries(game.board.faceUpByLevel) as Array<
          [string, number[]]
        >;

        if (draft.selectedLevel && draft.selectedCardId) {
          return completeDiscovery({
            level: draft.selectedLevel,
            cardId: draft.selectedCardId,
          });
        }

        return faceUpEntries.flatMap(([level, cardIds]) =>
          cardIds.map((cardId: number) => {
            const card = game.getCard(cardId);

            return {
              id: `${level}:${cardId}`,
              output: {
                level: Number(level),
                cardId,
                bonusColor: card.bonusColor,
                prestigePoints: card.prestigePoints,
                source: "face_up",
              },
              nextInput: {
                selectedLevel: Number(level),
                selectedCardId: cardId,
              },
              nextStep: SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard,
            };
          }),
        );
      })
      .build(),
  ])
  .isAvailable((context) => {
    return guardedAvailability(() => {
      const actorId = context.actorId;
      const game = context.game;
      const player = game.getPlayer(actorId);
      const faceUpPiles = Object.values(game.board.faceUpByLevel) as number[][];

      if (!player.canReserveMoreCards()) {
        return false;
      }

      return faceUpPiles.some((cards) => cards.length > 0);
    });
  })
  .validate(({ game, command }) => {
    return guardedValidate(() => {
      const actorId = command.actorId;
      const input = command.input;
      const player = game.getPlayer(actorId);

      if (!player.canReserveMoreCards()) {
        return { ok: false, reason: "reserved_limit_reached" };
      }

      const level = input.level;

      if (!isDevelopmentLevel(level)) {
        return { ok: false, reason: "invalid_level" };
      }

      if (!game.board.faceUpByLevel[level].includes(input.cardId)) {
        return { ok: false, reason: "card_not_face_up" };
      }

      return { ok: true };
    });
  })
  .execute(({ game, command, emitEvent }) => {
    const actorId = command.actorId;
    const input = command.input;
    const level = assertDevelopmentLevel(input.level);
    const player = game.getPlayer(actorId);

    player.reserveCard(input.cardId);
    game.board.removeFaceUpCard(level, input.cardId);
    game.board.replenishFaceUpCard(level);

    const receivedGold = player.gainGoldFrom(game.bank);
    emitEvent({
      category: "domain",
      type: "card_reserved",
      payload: {
        actorId,
        source: "face_up",
        level,
        cardId: input.cardId,
        receivedGold,
      },
    });
  })
  .build();

export { reserveFaceUpCardCommand };
```

**Step 4: Run tests to verify they pass**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add .
git commit -m "refactor(splendor): reserve_face_up_card delegates returns to stage"
```

### Task 8: End-To-End Overflow → Return → Turn-End Test

**Files:**

- Modify: `examples/splendor/engine/tests/game.test.ts`

**Step 1: Write the failing scenario test**

Append to `examples/splendor/engine/tests/game.test.ts`:

```ts
test("after overflow the active player returns tokens and the turn proceeds to p2", () => {
  const { gameExecutor, state } = createTestInitialState(["p1", "p2"]);

  state.game.players.p1!.tokens.white = 4;
  state.game.players.p1!.tokens.blue = 4;

  const taken = gameExecutor.executeCommand(state, {
    type: "take_three_distinct_gems",
    actorId: "p1",
    input: {
      colors: ["white", "blue", "green"],
    },
  });

  expect(taken.ok).toBe(true);
  if (!taken.ok) {
    throw new Error("expected take_three to succeed");
  }
  expect(taken.state.runtime.progression.currentStage).toMatchObject({
    id: "returnExcessiveTokens",
    activePlayerId: "p1",
  });

  const returned = gameExecutor.executeCommand(taken.state, {
    type: "return_tokens",
    actorId: "p1",
    input: {
      returnTokens: { white: 1 },
    },
  });

  expect(returned.ok).toBe(true);
  if (!returned.ok) {
    throw new Error("expected return_tokens to succeed");
  }
  expect(returned.state.game.players.p1?.tokens).toMatchObject({
    white: 4,
    blue: 5,
    green: 1,
  });
  expect(returned.state.game.players.p1?.tokens.totalCount?.()).toBeUndefined();
  expect(returned.state.runtime.progression.currentStage).toEqual({
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "p2",
  });
  expect(
    returned.events.some((event) => event.type === "tokens_returned"),
  ).toBe(true);
});
```

The `totalCount?.()` expectation is intentional — canonical state is plain data, not facades, so `totalCount` is undefined on the returned state. Adjust if your facade flow exposes the method on `result.state.game.*`; otherwise compute the total inline.

**Step 2: Run tests to verify the scenario passes**

Run: `bun test --cwd examples/splendor/engine tests/game.test.ts`
Expected: PASS — every existing and new test green. Also run the full suite:

```
bun test
```

from the repo root to confirm no other package broke.

**Step 3: Commit**

```bash
git add .
git commit -m "test(splendor): cover overflow → return → next turn end-to-end"
```

### Task 9: Sanity Pass And Cleanup

**Files:** Whole branch

**Step 1: Search for stale references**

Run:

```
rg "returnTokens" examples/splendor/engine/src/commands
rg "select_return_token" examples/splendor/engine/src/commands
```

Expected: only `examples/splendor/engine/src/commands/return-tokens.ts` references either. Investigate and clean up any stragglers.

**Step 2: Search the broader codebase**

Run:

```
rg "returnTokens" examples/splendor
rg "returnTokens" packages
```

Look for clients (terminal, web) that send `returnTokens` inside take/reserve command inputs. If any exist, file a follow-up note in the plan rather than fixing here — UI changes are out of scope for this plan.

**Step 3: Run typecheck and full test suite**

Run:

```
bun run typecheck
bun test
```

Both must succeed. Fix anything that breaks before continuing.

**Step 4: Commit any cleanups**

Only if Step 1 or 3 surfaced fixes:

```bash
git add .
git commit -m "chore(splendor): tidy return-token migration"
```

If nothing changed, skip the commit and move on.

### Task 10: Self-Review And Hand-Off

**Files:** None — read-only.

**Step 1: Walk through `git log --oneline main..HEAD`**

Confirm the commit titles read as a coherent narrative:

- `feat(splendor): add return_tokens command`
- `feat(splendor): add returnExcessiveTokens stage`
- `feat(splendor): route playerTurn through returnExcessiveTokens`
- `refactor(splendor): take_three_distinct_gems delegates returns to stage`
- `refactor(splendor): take_two_same_gems delegates returns to stage`
- `refactor(splendor): reserve_deck_card delegates returns to stage`
- `refactor(splendor): reserve_face_up_card delegates returns to stage`
- `test(splendor): cover overflow → return → next turn end-to-end`
- (optional) `chore(splendor): tidy return-token migration`

**Step 2: Diff the deletions in the four migrated commands**

Confirm each migrated command lost: the `returnTokens` field, the `select_return_token` step, the return-related validate branch, the `player.returnTokensTo(...)` call in `execute`, and any unused imports (`createReturnTokenDiscovery`, `assertGemTokenColor` if it was only used for return paths).

**Step 3: Confirm rules coverage**

The rules say: a player may never end their turn with more than 10 tokens, and may return any of those just drawn. Confirm:

- The new transition fires after every command that can grant tokens (`take_three_distinct_gems`, `take_two_same_gems`, `reserve_face_up_card`, `reserve_deck_card`).
- The `return_tokens` command lets the player return any tokens they own — the rule says "all or some of those they've just drawn," which the current `createReturnTokenDiscovery` already implements by allowing return of any owned token of any color.
- A buy command cannot increase token count, so the absence of an overflow path after buys is correct.

**Step 4: Stop**

The plan is implemented. Do not open a PR or merge — the user will decide on the integration step.

---

## Self-Review

**Spec coverage:** Every requirement listed at the top of the plan maps to a task. The new command is Task 1, new stage Task 2, transition routing Task 3, four command migrations Tasks 4–7, end-to-end coverage Task 8, cleanup Task 9, sign-off Task 10.

**Placeholder scan:** No "TODO," "TBD," or unspecified-implementation steps. Every code-changing step shows the actual code.

**Type consistency:** Method names (`getRequiredReturnCount`, `canReturnTokens`, `returnTokensTo`, `gainGoldFrom`), schema names (`returnTokensCommandSchema`), and id strings (`return_tokens`, `returnExcessiveTokens`, `tokens_returned`) match across tasks. The new option `getReturnExcessiveTokensStage` on `CreatePlayerTurnStageOptions` is introduced in Task 3 and consumed in `createSplendorStages` in the same task.

**Risk note:** Task 2 carries a deliberately-awkward intermediate state (`void returnExcessiveTokensStage`) so that the commit does not depend on Task 3's `createPlayerTurnStage` signature change. Task 3 cleans it up. If you'd rather collapse Tasks 2 and 3 into a single commit, you may — they share fate.
