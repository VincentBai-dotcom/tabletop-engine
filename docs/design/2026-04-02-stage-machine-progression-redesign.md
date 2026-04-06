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

## Flat-First Scope Decision

The legacy progression model implicitly carried inclusive context through
nested segments.

Example:

- a player phase was inside a player turn
- a player turn could be inside a round

That implicit inclusion is not preserved automatically by the new stage-machine
model.

This is an acknowledged tradeoff.

Decision:

- start with a fully flat stage machine
- do not add stage ancestry, parent scopes, or hierarchical stage semantics in
  the first redesign
- if real game implementations later prove that inclusive stage context is
  necessary, add a richer hierarchy or scope model then

Reasoning:

- the flat model is simpler to author and execute
- it keeps the first rewrite smaller and easier to reason about
- it avoids prematurely standardizing a hierarchy model before seeing concrete
  pressure from actual game implementations

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

- define stages one by one with a chained helper like `defineStage("...")`
- choose the stage kind through builder methods such as:
  - `.singleActivePlayer()`
  - `.automatic()`
- connect stages through explicit transitions or stage references
- pass only the initial stage into the game definition builder
- let the engine compile the reachable stage graph from that initial stage

The important design choice is:

- pass the initial stage only
- do not require the consumer to register a flat stage list manually

This keeps stage authoring aligned with the root state class pattern:

- one entry point
- engine discovers and compiles reachable structure

## Active Player And Automatic Stage Authoring

For the initial rewrite, the consumer-facing stage API should focus on:

- `activePlayer` stages
- `automatic` stages

`multipleActivePlayer` is intentionally deferred to its own narrower design
track.

### Active Player Stage

An `activePlayer` stage should define:

- `id`
- stage kind through `.singleActivePlayer()`
- `activePlayer({ game, runtime })`
- `commands`
- `nextStages`
- `transition({ game, runtime, command, nextStages, self })`
- `.build()`

Expected authoring shape:

```ts
const gameEndStage = defineStage("gameEnd").automatic().build();

const playerTurnStage = defineStage("playerTurn")
  .singleActivePlayer()
  .activePlayer(({ game, runtime }) => {
    const currentStage = runtime.progression.currentStage;

    return currentStage.kind === "activePlayer"
      ? game.getNextPlayerId(currentStage.activePlayerId)
      : game.firstPlayerId;
  })
  .commands([takeGemsCommand, reserveCardCommand, buyCardCommand])
  .nextStages({
    gameEndStage,
  })
  .transition(({ game, nextStages, self }) => {
    return game.isFinished() ? nextStages.gameEndStage : self;
  })
  .build();

const cleanupStage = defineStage("cleanup")
  .automatic()
  .run(({ game }) => {
    game.cleanupEndOfTurn();
  })
  .nextStages({
    playerTurnStage,
    gameEndStage,
  })
  .transition(({ game, nextStages }) => {
    return game.isFinished()
      ? nextStages.gameEndStage
      : nextStages.playerTurnStage;
  })
  .build();

const game = new GameDefinitionBuilder(...)
  .initialStage(playerTurnStage)
  .build();
```

### Automatic Stage

An `automatic` stage should define:

- `id` through `defineStage("...")`
- stage kind through `.automatic()`
- `run({ game, runtime })`
- `nextStages`
- `transition({ game, runtime, nextStages, self })`
- `.build()`

It should not define active-player selection.

An automatic stage represents:

- cleanup
- stage-to-stage routing
- deterministic resolution
- end-of-round or end-of-turn maintenance

Its logic runs inside the engine once entered, until the engine reaches the
next player-facing stage or a terminal condition.

### Design Decisions Behind This Shape

#### Required And Optional Builder Methods Should Differ By Stage Kind

The chained stage builder should not require the same methods for every stage
kind.

Required vs optional methods should be:

##### `singleActivePlayer`

Required before `.build()`:

- `.singleActivePlayer()`
- `.activePlayer(...)`
- `.commands(...)`
- `.transition(...)`

Optional:

- `.nextStages(...)`

If `.nextStages(...)` is omitted, then `transition(...)` should only be able to
return `self`.

Reasoning:

- a player-facing stage must define who is active
- it must define which command definitions belong to that stage
- it must define what happens after a player action completes

So `singleActivePlayer` stages are always part of an ongoing flow, not terminal
sink stages.

##### `automatic`

Required before `.build()`:

- `.automatic()`

Optional:

- `.run(...)`
- `.nextStages(...)`
- `.transition(...)`

Meaning:

- an `automatic` stage with `.transition(...)` is a routing or resolution stage
- an `automatic` stage without `.transition(...)` is terminal
- `.run(...)` is only needed if the automatic stage actually performs work
  before transitioning or terminating

This keeps terminal stages natural:

```ts
const gameEndStage = defineStage("gameEnd").automatic().build();
```

The design intention is:

- terminal stages live in `automatic`
- `singleActivePlayer` stages always remain explicit about how the flow
  continues after a player acts

#### Active Player Ownership Stays In `runtime.progression`

The current active player should remain progression runtime data, not game
state tree data.

This preserves the existing good boundary:

- board/domain state lives in `game`
- turn/stage control state lives in `runtime.progression`

So the stage machine should continue to store active player ids in runtime.

The progression runtime should expose the current stage as:

```ts
runtime.progression.currentStage;
```

not:

```ts
runtime.progression.stage;
```

Reasoning:

- `currentStage` makes the temporal meaning explicit
- it leaves room for future progression-level metadata
- it groups stage-specific runtime information into one coherent record

Expected runtime direction:

```ts
runtime.progression.currentStage = {
  id: "playerTurn",
  kind: "activePlayer",
  activePlayerId: "p2",
};
```

and later:

```ts
runtime.progression.currentStage = {
  id: "simultaneousSelection",
  kind: "multipleActivePlayer",
  activePlayerIds: ["p1", "p2", "p3", "p4"],
};
```

#### The Engine Owns Writing Active Players

The developer should not mutate `runtime.progression.activePlayerIds`
manually.

Instead:

1. the current stage finishes
2. the engine decides the next stage
3. the next `activePlayer` stage computes its active player from readonly
   `{ game, runtime }`
4. the engine writes the resulting active player ids into runtime progression

This keeps stage authoring declarative while preserving engine ownership of
progression bookkeeping.

#### `activePlayer({ game, runtime })` Should Be Narrow

The `activePlayer(...)` hook should receive readonly:

- `game`
- `runtime`

and nothing command-specific by default.

Reasoning:

- stage entry happens after the previous command resolves
- there is no new command being submitted to the next stage yet
- exposing ambiguous `actorId` or command-specific context would make the hook
  harder to reason about

The developer should derive the next active player from the current game state
and the previous progression runtime state.

#### Stage Authoring Should Also Use The Chained Builder Pattern

Stage authoring should follow the same direction as command authoring.

Reasoning:

- one-shot object literals produce poor editor feedback while the developer is
  still typing an incomplete stage definition
- stage definitions have the same problem commands had before the builder
  migration:
  - required fields may not all be present yet
  - the object shape changes materially once the stage kind is chosen
- a chained builder lets the editor expose only the methods relevant to the
  chosen stage kind
- `.build()` provides one explicit finalization point for required pieces such
  as:
  - `commands`, `nextStages`, and `transition(...)` for
    `singleActivePlayer` stages
  - `run(...)`, `nextStages`, and `transition(...)` for `automatic` stages

Desired direction:

- `defineStage("playerTurn").singleActivePlayer()...build()`
- `defineStage("cleanup").automatic()...build()`

This should replace the earlier one-shot `defineStage({ ... })` object pattern
in the public API design.

#### Stage Commands Should Be Static Command Definitions

Stages should list command definitions directly:

```ts
commands: [takeGemsCommand, reserveCardCommand, buyCardCommand];
```

Not:

```ts
possibleCommands: ["take_gems", "reserve_card", "buy_card"];
```

Reasoning:

- avoids fragile string indirection
- lets the builder derive the command registry from the reachable stage graph
- keeps stage authoring consistent with command authoring

These stage command lists are a static superset, not a dynamic guarantee that
every listed command is currently usable.

Dynamic narrowing still belongs to command logic:

- `isAvailable()` for current availability
- `validate()` for submitted-input legality

This supports asymmetric games cleanly, because a stage can expose a static
superset of relevant commands while each command still decides whether it is
actually available to the current player in the current game state.

#### Game Definition Builder Should Stop Accepting `.commands(...)`

Because stages now reference command definitions directly, the builder should no
longer require a separate `.commands(...)` registration step.

Desired direction:

- `GameDefinitionBuilder.initialStage(...)` receives the root stage
- the builder compiles the reachable stage graph
- while compiling stages, the builder also collects the command definitions
  referenced by those stages

This command collection step should:

- include each reachable command once only
- handle the fact that the same command may appear in many stages
- build the canonical command registry from the stage graph rather than from a
  separate builder input

This keeps the new progression API consistent:

- stages are the source of truth for which commands belong to the game flow
- the builder derives the registry from those stages
- consumers do not have to register the same command twice through both stage
  definitions and `.commands(...)`

#### Stage Graph Compilation Requires Static Outgoing Stage References

The builder cannot compile the reachable stage graph if `transition(...)` is
the only source of next-stage information and may return stages dynamically.

So stages should also declare a static superset of possible next stages:

```ts
nextStages({
  playerTurnStage,
  gameEndStage,
});
```

while `transition(...)` performs runtime selection:

```ts
transition(({ game, nextStages, self }) => {
  return game.isFinished() ? nextStages.gameEndStage : self;
});
```

The `transition(...)` hook should not return arbitrary stage objects.
Instead it should receive:

- `nextStages`
  the statically declared named outgoing stages from `.nextStages({...})`
- `self`
  the current stage, always available for self-loop transitions

This means:

- self-looping does not need to be declared separately
- transition targets are constrained to statically declared edges plus self
- the developer gets autocomplete on named transition targets

Because `.nextStages({...})` uses normal object literals, developers may use
either semantic aliases:

```ts
nextStages({
  gameEnd: gameEndStage,
});
```

or plain variable-name keys:

```ts
nextStages({
  gameEndStage,
});
```

This mirrors the stage-command split:

- `commands`
  static superset of commands that may occur in this stage
- `nextStages`
  static superset of stages this stage may transition to
- `transition(...)`
  dynamic selection of the actual next stage

This is required so the builder can:

- discover the full reachable stage graph from `initialStage`
- validate stage references
- compile the command registry from reachable stages
- support future protocol and tooling generation from the compiled graph

#### Stage References Stay Internal To The Builder And Executor

The stage objects exposed through:

- `.nextStages({...})`
- `transition(...).nextStages`
- `transition(...).self`

are authoring-time and executor-time handles only.

They should not appear in canonical runtime state.

The persisted runtime should continue to store only serializable stage data
such as:

- `runtime.progression.currentStage.id`
- `runtime.progression.currentStage.kind`
- `runtime.progression.currentStage.activePlayerId`

This keeps the boundary clean:

- stage-definition object references stay internal
- canonical state stays plain serializable data
- AsyncAPI and other protocol generation continue to describe the serialized
  runtime shape, not the in-memory stage graph

#### Keep Current-Stage Runtime Minimal For `activePlayer` And `automatic`

The first rewrite should not introduce a vague generic field like `local` on
every current-stage runtime object.

For now:

- `activePlayer` stages only need `activePlayerId`
- `automatic` stages do not need stage-scoped runtime memory at all

So the current-stage runtime shape should stay minimal for these kinds:

```ts
runtime.progression.currentStage = {
  id: "playerTurn",
  kind: "activePlayer",
  activePlayerId: "p2",
};
```

```ts
runtime.progression.currentStage = {
  id: "cleanup",
  kind: "automatic",
};
```

If later stage kinds such as `multipleActivePlayer` require stage-scoped memory
for submission tracking or buffering, that field can be added specifically for
those stage runtime variants instead of being introduced everywhere up front.

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
