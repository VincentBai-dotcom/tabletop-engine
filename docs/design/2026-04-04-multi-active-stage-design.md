# Multi-Active Stage Design

## Status

Accepted as a focused design direction within the broader stage-machine
progression redesign.

This document narrows in on `multipleActivePlayer` stages only.

## Problem

`multipleActivePlayer` stages are more complicated than `activePlayer` stages.

The engine needs to support cases where:

- several players are concurrently eligible to act
- different active players may have different commands available
- a stage may require buffering submissions before effects are applied
- a stage may instead execute commands immediately
- stage completion may depend on game-specific criteria, not one fixed rule

The engine should support this while preserving the core execution contract:

```ts
nextState = gameExecutor.executeCommand(currentState, command);
```

The backend should not need a separate API to advance progression.

## Definition

A `multipleActivePlayer` stage is a progression stage in which the engine
treats several players as concurrently eligible to submit stage-scoped actions
before the stage is considered complete.

This definition intentionally does not imply:

- all active players share the same command set
- all active players must submit exactly once
- submissions are always buffered
- submissions are always hidden
- submissions always execute immediately

`multipleActivePlayer` only describes the multi-actor coordination shape of the
stage. The rest is stage-specific policy.

## Non-Goal

Do not define `multipleActivePlayer` as:

- "a stage where everyone submits one command and then the engine resolves"

That is one use case, not the definition.

## Why Not Model It As Several Single-Player Stages

Several simultaneous `activePlayer` stages would still need an outer mechanism
to answer:

- which of those stages belong to the same coordination window
- when the group is complete
- how their submissions interact
- when the game moves on

Once that outer mechanism exists, the system has effectively reintroduced a
shared multi-actor stage. The more honest model is to make that shared stage
explicit.

## Core Design

The stage definition should control three separate concerns:

1. who is active
2. what happens when a command is submitted
3. when the stage is complete and how it transitions

This should not be collapsed into one flag such as `delayExecution: true`.

## Recommended Developer-Facing Model

For `multipleActivePlayer` stages, expose:

- `activePlayers(...)`
  resolves which players are currently active in the stage
- `possibleCommands(...)`
  resolves which command ids are currently allowed, potentially per actor
- `submission`
  configures what the engine does when a command is submitted in this stage
- `transition(...)`
  determines what stage comes next once the stage is complete

The key design choice is that `submission` is explicit and stage-owned.

## Submission Policy

The engine should not assume that all multi-active stages behave the same way.

Instead, the stage should define a submission policy.

At minimum:

```ts
submission: {
  mode: "immediate" | "buffered";
}
```

This mode controls whether commands in the stage:

- execute against the game state immediately
- or are recorded in progression runtime memory for later resolution

This is the minimum setting needed to express the difference between:

- ordinary open multi-actor action windows
- hidden simultaneous-choice collection windows

## Buffered Submission Stages

Buffered stages are required for games where partial execution would reveal
information too early through `getView(...)`.

In these stages:

- a submitted command is validated as a legal submission
- the engine records it in progression-local runtime memory
- the game state tree is not mutated yet
- the stage stays active until its completion condition is met
- once ready, the engine resolves the buffered submissions deterministically

This logic should be owned by the engine, not by the backend.

The backend should still only call:

```ts
nextState = gameExecutor.executeCommand(currentState, command);
```

## Immediate Submission Stages

Some multi-active stages should execute immediately.

Examples include:

- ready checks
- open acknowledgements
- multi-player contribution windows where visibility is not a problem
- reaction windows that should mutate shared state as choices arrive

In these stages:

- the command executes immediately
- the stage may still use progression-local memory if needed
- completion is still determined by the stage definition

So `multipleActivePlayer` does not automatically imply buffering.

## Stage-Defined Completion

The stage must define when it is complete.

This should remain stage-specific because different games may require:

- all active players to submit once
- only a subset of players to submit
- one player to submit multiple commands
- submissions until quorum is reached
- submissions until some shared resource threshold is met
- submissions until everyone passes

So the completion condition belongs to the stage, not to the engine's generic
definition of `multipleActivePlayer`.

## Recommended Buffered Hooks

For buffered stages, the stage should be able to define hooks in this shape:

```ts
submission: {
  mode: "buffered",

  init() {
    return {};
  },

  accept({ game, actorId, command, local, activePlayerIds }) {
    return { ok: true };
  },

  record({ game, actorId, command, local, activePlayerIds }) {
    return local;
  },

  shouldResolve({ game, local, activePlayerIds }) {
    return false;
  },

  resolve({ game, local, activePlayerIds }) {},
}
```

Meaning:

- `init`
  initializes stage-local memory on entry
- `accept`
  stage-level submission legality before command execution or buffering
- `record`
  updates stage-local buffered submission state
- `shouldResolve`
  determines whether the stage is now ready to resolve
- `resolve`
  applies the buffered submissions once ready

These names can still change, but this is the right responsibility split.

## Transition Ownership

Transition logic should still be engine-owned, not backend-owned.

The stage definition may decide:

- stay in the same stage
- transition to another player-facing stage
- transition into an `automatic` stage for deterministic resolution

The important invariant is:

- command submission enters through `executeCommand(...)`
- stage-local policy decides whether the command executes now or is buffered
- the engine then decides whether the stage remains active or transitions

## Runtime Shape

The progression runtime needs stage-local memory for buffered stages.

Example:

```ts
runtime.progression = {
  currentStageId: "simultaneousSelection",
  activePlayerIds: ["p1", "p2", "p3", "p4"],
  local: {
    submissions: {
      p1: { commandType: "choose_card", input: { cardId: 3 } },
      p2: { commandType: "choose_card", input: { cardId: 8 } },
    },
  },
};
```

This is progression runtime memory, not game state tree data.

It should be hidden from ordinary board-state views unless explicitly exposed.

## Relationship To Other Deferred Systems

Buffered submissions are not the same as:

- an event queue
- a resolution stack

These are separate concerns.

- submission buffer
  pending player intents collected by a stage
- event queue
  pending triggered follow-up work
- resolution stack
  pending nested rules/effects awaiting resolution order

The progression subsystem should keep submission buffering separate from those
future systems.

## Command Responsibility Under This Model

Commands should not decide whether they are being played in the correct stage.

Instead:

- the stage definition and engine determine whether the command is legal at the
  current moment
- the command determines whether the move itself is semantically legal

So command `isAvailable()` and `validate()` should focus on move legality, not
generic stage membership.

## Example Direction

```ts
const chooseCardStage = defineStage({
  id: "chooseCard",
  kind: "multipleActivePlayer",

  activePlayers({ game }) {
    return game.getAlivePlayerIds();
  },

  possibleCommands({ actorId }) {
    return actorId ? ["choose_card"] : [];
  },

  submission: {
    mode: "buffered",

    init() {
      return {
        submissions: {},
      };
    },

    accept({ actorId, activePlayerIds }) {
      return {
        ok: !!actorId && activePlayerIds.includes(actorId),
      };
    },

    record({ actorId, command, local }) {
      return {
        ...local,
        submissions: {
          ...local.submissions,
          [actorId!]: command.input,
        },
      };
    },

    shouldResolve({ activePlayerIds, local }) {
      return activePlayerIds.every(
        (playerId) => local.submissions[playerId] !== undefined,
      );
    },

    resolve({ game, local }) {
      game.resolveChosenCards(local.submissions);
    },
  },

  transition() {
    return revealStage;
  },
});
```

The exact API names can still change, but this is the intended developer
experience.

## Open Questions

Still undecided:

- whether `possibleCommands(...)` should return one shared list or actor-scoped
  command sets
- whether buffered submissions should store full command objects or only
  command inputs
- whether `resolve(...)` should live inside the buffered stage or always happen
  in a following `automatic` stage
- whether stage-local memory should be schema-authored for stronger protocol and
  runtime typing

These are follow-up design questions, not blockers for the overall direction.
