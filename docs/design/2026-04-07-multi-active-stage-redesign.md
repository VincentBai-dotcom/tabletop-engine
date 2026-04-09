# Multi-Active Stage Redesign

## Status

Accepted as the current design direction for `multiActivePlayer` stages.

This document replaces the earlier multi-active stage design note. The previous
version assumed a more engine-managed buffering model. That is no longer the
preferred direction.

## Goal

Extend the stage-machine progression system with a `multiActivePlayer` stage
kind that can model shared coordination windows where several players may act
before the stage is complete.

This must preserve the core engine contract:

```ts
nextState = gameExecutor.executeCommand(currentState, command);
```

The backend should not need a separate progression API.

## Definition

A `multiActivePlayer` stage is a progression stage in which several players are
concurrently eligible to submit stage-scoped commands, and the stage remains
active until game-defined completion logic says the coordination window is done.

This definition intentionally does not imply:

- all active players share the same command set at runtime
- all active players submit exactly once
- submitted commands execute immediately
- submitted commands are always buffered
- stage completion is tied to one fixed engine rule

## Why It Is A Separate Stage Kind

This should not be modeled as several simultaneous single-player stages.

The important difference is shared coordination:

- one current stage identity
- one shared completion rule
- one shared transition point
- one shared temporary coordination state

If the engine had to add an outer mechanism to coordinate several single-player
stages, it would effectively be reintroducing a multi-active stage indirectly.

## Lifecycle

The lifecycle of a `multiActivePlayer` stage should be:

1. enter stage
2. initialize stage memory
3. compute active players
4. wait for a command from one of the active players
5. after each submitted command:
   - reject if the actor is not currently active
   - reject if the command type is not in the stage's static command list
   - run the stage's `onSubmit(...)` hook
6. recompute active players
7. run `isComplete(...)`
8. if incomplete, remain in the same stage and wait for more commands
9. if complete, run `transition(...)`
10. enter the next stage

Key difference from `singleActivePlayer`:

- one submitted command usually does not complete the stage
- the stage stays active across multiple submissions
- `transition(...)` only runs after `isComplete(...)` becomes true

## Core Builder Shape

Recommended public authoring shape:

```ts
const mulliganStage = defineStage("mulligan")
  .multiActivePlayer()
  .memory(
    t.object({
      submittedByPlayerId: t.record(t.string(), t.boolean()),
    }),
    () => ({
      submittedByPlayerId: {},
    }),
  )
  .activePlayers(({ game, memory }) => {
    return game.playerOrder.filter((playerId) => {
      return memory.submittedByPlayerId[playerId] === undefined;
    });
  })
  .commands([keepHandCommand, redrawHandCommand])
  .onSubmit(({ command, memory, execute }) => {
    memory.submittedByPlayerId[command.actorId] = true;
    execute(command);
  })
  .isComplete(({ game, memory }) => {
    return game.playerOrder.every((playerId) => {
      return memory.submittedByPlayerId[playerId] !== undefined;
    });
  })
  .nextStages(() => ({
    playerTurnStage,
  }))
  .transition(({ nextStages }) => {
    return nextStages.playerTurnStage;
  })
  .build();
```

## Required And Optional Builder Methods

### Required

- `.multiActivePlayer()`
- `.memory(schema, () => initialMemory)`
- `.activePlayers(...)`
- `.commands([...])`
- `.onSubmit(...)`
- `.isComplete(...)`
- `.nextStages(...)`
- `.transition(...)`

### Optional

None in the first design.

Reasoning:

- a multi-active stage always needs temporary coordination state
- it always needs to define who is currently active
- it always needs explicit completion and transition behavior
- unlike `automatic`, it is not a natural terminal sink stage kind

## Memory

`multiActivePlayer` stages should declare coordination memory explicitly with:

```ts
.memory(schema, () => initialMemory)
```

This method does two things:

- binds the runtime schema and static type for all later hooks
- provides the initial value on stage entry

This replaces a separate `.initialize(...)` hook.

The memory schema should be authored with the normal `t.*` schema API. This is
required so the engine can later include multi-active memory in runtime-state
validation and snapshot validation.

The memory schema should follow the same schema constraints as command input
and discovery input:

- no `t.state(...)`
- top-level schema must be `t.object(...)`

This keeps multi-active memory clearly in the plain-runtime-data world rather
than the facade-state world.

### Why Memory Is Required

The coordination rules of a multi-active stage usually need temporary state,
such as:

- which players have already submitted
- what each player submitted
- whether a player has passed
- how many submissions have been seen so far

This belongs to progression runtime, not the game state tree.

### Why Not Use `@State`

`@State()` is for authoritative game state facades. It is not a good fit for
multi-active coordination memory.

Coordination memory may need to store:

- previously submitted commands
- temporary coordination flags
- derived per-stage bookkeeping

That data should stay plain and serializable inside progression runtime.

### Why A Runtime Schema Is Required

Type-only memory such as:

```ts
.memory<T>(() => initialMemory)
```

is not sufficient for the longer-term engine direction.

The engine also needs a runtime schema for multi-active memory so it can:

- validate the runtime portion of full canonical state
- validate restored snapshots
- assemble an engine-owned runtime schema that includes game-authored
  multi-active memory shapes

The engine can reuse the same serializable-schema validation path already used
for command input and discovery input schemas when enforcing these rules.

So multi-active memory should be declared with both:

- a `t.*` runtime schema
- an initializer function

## Memory In Hook Contexts

The stage memory should be available in the contexts for:

- `activePlayers(...)`
- `onSubmit(...)`
- `isComplete(...)`
- `transition(...)`

Reasoning:

- `activePlayers(...)` may need memory to determine who is still active
- `onSubmit(...)` needs to read and mutate memory
- `isComplete(...)` often depends on memory
- `transition(...)` may choose the next stage based on memory

## Active Players

`multiActivePlayer` stages should define:

```ts
.activePlayers(({ game, runtime, memory }) => string[])
```

This returns the players who are currently active in the stage.

Important design decision:

- active players are not mutated directly by `onSubmit(...)`
- instead, `activePlayers(...)` is recomputed after each accepted submission
- the hook derives the latest active player set from:
  - game state
  - runtime
  - stage memory

This supports cases like mulligan windows where a player becomes inactive after
submitting once, without exposing a direct active-player mutation API.

## Commands

Like `singleActivePlayer`, a `multiActivePlayer` stage should expose:

```ts
.commands([...])
```

This is the static superset of command definitions relevant to the stage.

Dynamic narrowing should still happen in command logic, not in the stage
definition. This keeps responsibilities aligned with the rest of the command
system:

- stage owns timing and coordination
- command owns move legality

## `onSubmit(...)`

The primary coordination hook should be named:

```ts
.onSubmit(...)
```

This name reflects that the hook runs when one active player submits one
command into the stage.

Recommended context shape:

- `game`
- `runtime`
- `memory`
- `command`
- `execute(command)`

### Responsibilities Of `onSubmit(...)`

`onSubmit(...)` should let the developer:

- inspect the newly submitted command
- update stage memory
- decide whether to execute the submitted command immediately
- choose when to execute previously stored commands, by reading from memory

This gives the developer full control over execution timing and ordering.

### Why This Simpler Model Is Preferred

Earlier designs considered:

- engine-managed command buffers
- opaque submitted-command handles
- hook return values such as `reject | buffer | execute`

Those designs added too much framework machinery.

The preferred direction is simpler:

- the stage owns coordination logic in `onSubmit(...)`
- the engine exposes a narrow imperative helper: `execute(command)`
- the stage stores any queued or prior commands in its own memory

This keeps the API easier to learn and avoids special engine-owned submission
objects.

## `execute(command)` Semantics

The `execute(command)` helper in `onSubmit(...)` should:

- execute the provided command immediately
- apply the command through the normal engine execution path
- mutate game state inside the same overall transaction

The stage developer decides:

- whether to call `execute(...)`
- when to call it
- in what order to call it for multiple stored commands

This gives the stage full control over deferred or ordered resolution without
introducing a separate `resolve(...)` hook.

## `isComplete(...)`

`isComplete(...)` should remain a separate hook.

Recommended shape:

```ts
.isComplete(({ game, runtime, memory }) => boolean)
```

Reasoning:

- completion logic is conceptually different from transition routing
- it matches the actual lifecycle of the stage
- it avoids encoding "not complete yet" as an awkward self-transition

So the flow is:

- `onSubmit(...)` handles one submission
- `isComplete(...)` checks whether the coordination window is done
- `transition(...)` runs only once the answer is true

## `transition(...)`

`transition(...)` should behave like the other stage kinds:

- it only runs after the stage is complete
- it receives `memory`
- it returns one of the statically declared `nextStages`

Recommended shape:

```ts
.transition(({ game, runtime, memory, nextStages }) => ...)
```

## Runtime Shape

The current progression runtime already stores the public stage state in:

- `runtime.progression.currentStage`

For multi-active stages, the public portion should include:

- stage id
- stage kind
- `activePlayerIds`

This is what the client can rely on to know who is currently active.

The private coordination memory for the stage should also live in progression
runtime, but it is not the same thing as the public active-player list.

Example conceptual shape:

```ts
runtime.progression = {
  currentStage: {
    id: "mulligan",
    kind: "multiActivePlayer",
    activePlayerIds: ["p2", "p4"],
    memory: {
      submittedByPlayerId: {
        p1: true,
        p3: true,
      },
    },
  },
  lastActingStage: {
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "p1",
  },
};
```

The exact memory contents are game-authored, but the storage location should be
part of the current multi-active stage runtime itself:

- active player lists are public stage runtime
- coordination memory is current-stage runtime data, not game state facade data

## Non-Goals For This Iteration

Do not add yet:

- a trigger engine
- a general event queue
- a stack / response system
- declarative engine-owned buffering policies
- opaque submission handles
- direct stage-level mutation of the active player list

These can be reconsidered later if real games prove they are necessary.
