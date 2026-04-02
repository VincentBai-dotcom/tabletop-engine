# Stage-Machine Progression Redesign

## Status

Accepted as the new direction for progression redesign.

This document replaces the earlier progression authoring redesign direction.
The previous document assumed a hybrid declarative plus imperative API over the
existing progression model. That is no longer the direction. The redesign
should instead be based on an explicit stage machine.

## Problem

The current progression subsystem has multiple issues:

- the nested progression structure is cumbersome to author
- the structure gets hard to read as game flow becomes more complex
- the current model does not naturally express automatic transition states
- the current model does not naturally express multiple players being active at
  the same time
- the current model does not provide a clean place for progression-local memory
  such as tracking which players have already submitted choices

These issues are structural enough that the right move is a subsystem rewrite,
not incremental refinement.

## Core Direction

Progression should be redesigned as an explicit stage machine.

Key decisions:

- use `stage`, not `state`, for progression terminology
- keep `state` reserved for the authoritative game state tree authored with
  `@State()`
- a game starts from one initial stage
- later stages are discovered through transitions from that initial stage
- the engine, not the backend, owns all progression movement
- backend integration should remain:
  - `nextState = gameExecutor.executeCommand(currentState, command)`
- no separate backend-driven progression transition API should be required

If only one concept deserves the plain word `state`, it is the game state tree,
not the progression machine.

## Terminology

Use these terms consistently:

- `state`
  the authoritative game data tree
- `stage`
  a node in the progression machine
- `currentStageId`
  the active progression stage
- `initialStage`
  the entry stage for a game definition

Avoid using plain `state` for progression concepts in the public API.

## Progression Authoring

Stages should be authored as separate units, similar to commands.

Recommended authoring style:

- define stages one by one with a helper like `defineStage(...)`
- connect stages through explicit transitions or stage references
- pass only the initial stage into the game definition builder
- let the engine compile the reachable stage graph from that initial stage

Expected consumer feel:

```ts
const gameEndStage = defineStage({
  id: "gameEnd",
  kind: "automatic",
});

const nextPlayerStage = defineStage({
  id: "nextPlayer",
  kind: "automatic",
  transitions: {
    nextTurn: () => playerTurnStage,
    endGame: () => gameEndStage,
  },
  run({ game, command, transition }) {
    const actorId = command.actorId;

    if (!actorId || game.isFinished()) {
      transition("endGame");
      return;
    }

    game.setActivePlayer(game.getNextPlayerId(actorId));
    transition("nextTurn");
  },
});

const playerTurnStage = defineStage({
  id: "playerTurn",
  kind: "activePlayer",
  possibleCommands: ["play_card", "pass_turn"],
  transitions: {
    commandResolved: () => nextPlayerStage,
  },
});

const game = new GameDefinitionBuilder(...)
  .commands([...])
  .initialStage(playerTurnStage)
  .build();
```

The important design choice is:

- pass the initial stage only
- do not require the consumer to register a flat stage list manually

This keeps stage authoring aligned with the root state class pattern:

- one entry point
- engine discovers and compiles reachable structure

## Stage Kinds

The redesign should support at least these stage kinds:

- `activePlayer`
  exactly one active player can act
- `multipleActivePlayer`
  multiple players are active and can each submit one command
- `automatic`
  no player acts directly; the engine runs stage logic and transitions

An internal bootstrap or terminal kind can be added later if needed, but the
main authoring model should revolve around these three.

## Engine-Owned Progression

The engine must own all progression transitions.

This is a hard constraint.

Not desired:

- backend calling a separate transition API on the executor
- backend deciding when to move to the next stage directly

Desired:

- backend submits one command at a time
- engine validates and executes that command
- engine updates progression-local memory if needed
- engine decides whether the current stage remains active or transitions
- if the next stage is automatic, the engine runs it inside the same overall
  execution flow until it reaches a player-facing stage or terminal stage

The only required server integration should remain:

```ts
nextState = gameExecutor.executeCommand(currentState, command);
```

## Multiple Active Player Stages

The engine should support multiple active players without adding a
simultaneous-command batch API.

The agreed direction is:

- each client still submits its own command independently
- the executor still accepts one command at a time
- a `multipleActivePlayer` stage stores submission progress in progression
  runtime memory
- once each required player has submitted one valid command, the engine
  transitions automatically
- duplicate submissions from a player in the same stage should be rejected
  unless the stage explicitly allows replacement behavior

This means the progression runtime itself must carry local machine memory.

Example conceptual runtime shape:

```ts
runtime.progression = {
  currentStageId: "simultaneousSelection",
  activePlayerIds: ["p1", "p2", "p3", "p4"],
  local: {
    submittedByPlayerId: {
      p1: { cardId: 3 },
      p2: { cardId: 8 },
    },
  },
};
```

The backend should not be responsible for collecting all four commands before
the engine can move on. The engine should track that internally through
progression-local memory.

## Resolution Model For Simultaneous Choices

Even for simultaneous-choice games, the engine should still execute one command
at a time.

Not desired:

- `executeCommand(currentState, [commands])`

Desired:

- players submit one command each into the current `multipleActivePlayer` stage
- the stage records each submission
- when the stage becomes complete, the engine transitions into an `automatic`
  resolution stage
- that automatic stage resolves the accumulated choices deterministically

So the typical simultaneous pattern becomes:

1. `multipleActivePlayer` collection stage
2. `automatic` resolution stage
3. next player-facing stage

This keeps the command execution contract simple while still supporting
simultaneous-decision games.

## Progression Runtime Shape

The progression runtime model should be redesigned around machine execution,
not the current nested segment tree.

At minimum it should store:

- `currentStageId`
- `activePlayerIds`
- `local`

It may later store additional metadata such as transition history or entry
sequence, but those are secondary.

The important addition is `local`: stage-scoped progression memory.

This is the place for data such as:

- which players have already submitted this round
- hidden pending selections
- counters for repeated automatic loops
- per-stage temporary control flags

## Responsibility Split

The redesign should move timing responsibility out of commands and into stage
definitions plus the engine.

Stage system responsibility:

- whether a command family is allowed in the current stage
- which players are active in the current stage
- stage-local submission rules
- whether the current stage is complete
- when and where progression transitions next

Command responsibility:

- whether a specific move is legal on the board
- whether targets are valid
- whether resources or payments are valid
- whether the submitted input satisfies command-specific rules

Under this model, commands should generally not be responsible for checking
whether they are being executed during the correct stage. The engine should
block wrong-stage execution before calling command `isAvailable()` or
`validate()`.

Expected engine flow:

1. read current stage
2. verify the submitted command type is allowed in this stage
3. verify the actor is eligible to act in this stage
4. only then call command `isAvailable()`, `validate()`, and `execute()`

This means command implementations can usually assume they are running at the
right time, while still retaining responsibility for game-specific legality.

`isAvailable()` and `validate()` should remain useful, but they should focus on
move semantics, not generic progression timing.

## Hook Context Direction

Stage logic should continue to receive the hydrated mutable `game` facade.

That is still desirable.

However, stage logic should not receive raw command payload unions as a general
public pattern. The engine should expose stable execution facts and the current
submitted command where appropriate, but the redesign should avoid pushing
consumers toward progression code that depends on unrelated command input
shapes.

This area should be finalized when the stage-machine API is implemented.

## Non-Goals Of This Decision

This document does not lock:

- exact stage helper names
- exact transition helper API
- exact shape of progression-local schema support
- migration sequence from the current progression subsystem
- how progress bars or UI-facing descriptions are modeled

Those should be decided in a later implementation plan.

## Accepted Outcome

The current accepted direction is:

- progression should be rewritten as a stage machine
- `stage` should replace progression uses of `state`
- `state` remains reserved for the game state tree
- stages should be authored individually and compiled from one `initialStage`
- the engine must own progression transitions completely
- backend integration should remain a single-command executor call
- `multipleActivePlayer` stages should be supported without batch command
  execution
- progression runtime must support stage-local memory so the engine can track
  which players have already submitted
