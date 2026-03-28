# State Facade Authoring Design

> Superseded in field-metadata details by
> `docs/design/2026-03-27-field-runtime-type-authoring-design.md`. This
> document still captures the broader state-facade execution model.

## Purpose

This document records the target direction for game-state authoring ergonomics
in `tabletop-kernel`.

The goal is to let consumers author game state in an object-oriented,
domain-shaped way while preserving the kernel's current pure canonical-state
model.

## Problem

The current authoring model expects consumers to define game state mainly as
plain nested interfaces and then mutate the plain state tree directly in
commands.

That causes two problems:

- the state authoring experience becomes hard to read as games get larger
- commands become too coupled to the raw canonical tree shape

The kernel still wants to preserve:

- plain serializable canonical state
- deterministic replay and snapshots
- reducer-style execution semantics

So the problem is not the canonical runtime model itself. The problem is the
consumer-facing authoring layer.

## Locked Direction

The kernel should provide a class-oriented state authoring layer built on top
of the existing plain canonical state tree.

The chosen authoring model is:

- `@State()` class decorators to mark state classes
- `@field(...)` plus runtime field types from `t`
- one explicit `rootState(...)` entrypoint on the builder

The consumer experience should look more like:

```ts
@State()
class PlayerState {
  @field(t.number())
  health!: number;

  @field(t.state(() => HandState))
  hand!: HandState;

  dealDamage(amount: number) {
    this.health -= amount;
  }
}
```

Commands should receive the root state object rather than the raw plain state
tree.

The state objects used by commands are not the canonical stored state. They are
temporary hydrated facades over a cloned plain state tree.

## Chosen Model

The chosen approach is:

- build-time compilation of the root state class into metadata
- runtime hydration of temporary facade objects over a cloned plain state tree

This keeps the current kernel execution model intact while improving the
consumer-facing authoring model.

## High-Level Flow

### Definition Time

The consumer defines:

- a root state class
- nested sub-state classes reachable from that root
- command definitions that operate on the root state object
- rule/effect objects that may operate across multiple substates when needed

The builder should take one explicit root state:

```ts
new GameDefinitionBuilder("splendor")
  .rootState(GameState)
  .commands(SplendorCommandList)
  .progression(...)
  .build();
```

When `build()` is called, the kernel compiles metadata from the root state
class graph.

That compiled metadata should describe:

- the root state class
- nested state class relationships
- field decorator metadata
- field layout
- hydration logic
- how commands are wrapped to run against hydrated facades

The state graph should be traversed from the explicit root state. The design
does not rely on global scanning of all decorated classes as the primary source
of truth.

### Execution Time

The executor should continue operating on plain canonical state.

For each execution:

1. receive canonical plain state
2. clone the canonical state into a working copy
3. hydrate a temporary root state facade over the cloned plain game tree
4. run command logic against that facade
5. discard the facade objects
6. return the mutated plain canonical clone

So the kernel remains pure-function-shaped externally:

- input state
- input command
- output next state

The object layer exists only for consumer ergonomics.

## State Metadata Model

The locked metadata direction is:

- use `@State()` to mark state classes
- use `@field(...)` with kernel-owned runtime field types from `t`
- do not rely on TypeScript field types alone

Reason:

- TypeScript interfaces and field types are not reliably available at runtime
- the kernel needs runtime-visible metadata for hydration and traversal
- collection and optional fields cannot be inferred safely from `instanceof`
  checks alone

The decorators provide the runtime metadata the builder needs to compile the
root state graph into canonical plain-data form.

## Command Experience

Commands should receive the hydrated root state object in `execute()`.

Example target experience:

```ts
class BuyCardCommand implements CommandDefinition<GameState, BuyCardInput> {
  commandId = "buy_card";

  execute({ game, commandInput }) {
    game.market.buyCard(commandInput.payload.cardId, commandInput.actorId);
  }
}
```

Here:

- `game` is a temporary hydrated root state object
- it is backed by the cloned canonical plain data
- commands can orchestrate through that root object
- direct field mutation in commands is still not the intended pattern

## Mutation Rule

Locked direction:

- commands should not mutate state fields directly
- commands should mutate only through state object methods

So this is the intended pattern:

```ts
game.player(actorId).takeToken("red");
```

And this is not the intended pattern:

```ts
game.players[0].tokens.red += 1;
```

Reason:

- mutation boundaries become explicit
- domain behavior lives with the state object that owns it
- commands become orchestration layers rather than raw tree mutation scripts
- this leaves room for future effect-resolution abstractions

This rule is about direct field mutation. It does not mean every piece of game
logic must become a method on the lowest state object it touches.

## Cross-State Rule Logic

The design should not force all cross-state logic to live on the root state
class or on the lowest common ancestor in the state tree.

That is especially important for card games, where card effects often touch
many substates at once.

The locked direction is:

- state classes own state-scoped mutation methods
- commands and effects may orchestrate across multiple substates through the
  root game facade
- cross-cutting rule logic may live in separate effect or utility objects

So for card games:

- card instances remain part of the state tree
- card definitions and effect logic may live in an external immutable registry
- the registry is not part of persistent match state

Example direction:

```ts
class PlayCardCommand implements CommandDefinition<GameState, PlayCardInput> {
  constructor(private readonly cards: CardDefinitionRegistry) {}

  execute({ game, commandInput }) {
    const card = game.currentPlayer.hand.getCard(commandInput.payload.cardId);
    const definition = this.cards.get(card.definitionId);

    definition.effect.resolve(game, {
      sourceCardId: card.id,
      targetId: commandInput.payload.targetId,
    });
  }
}
```

In that model:

- `CardState` is persistent state
- `CardDefinitionRegistry` is immutable rule-definition data
- `effect.resolve(...)` is rule logic, not state

This preserves the pure functional executor model as long as the external rule
registry is immutable and deterministic.

## Pure Functional Behavior

The kernel preserves purity at the executor boundary, not by forbidding
internal mutation completely.

The design is:

- externally pure reducer-style execution
- internally mutable working copy during a single execution

That means:

- the canonical stored state remains plain data
- replay and snapshots remain unchanged in principle
- facade objects are temporary and never become part of persisted state

This is effectively:

- internally mutable
- externally pure

which matches the current kernel execution model while providing a better
consumer-facing DSL.

More precisely, the intended execution contract is:

- the executor takes current canonical state plus command input
- it returns next canonical state plus result/events
- it does not depend on hidden mutable process state
- it does not mutate the caller's existing canonical state in place

So the observable execution model remains reducer-shaped:

```ts
next = execute(currentState, commandInput);
```

Even if the executor clones a working copy and mutates that copy internally,
the public execution boundary remains deterministic and state-in/state-out.

That is valuable because it preserves:

- deterministic replay
- easier testing
- easier debugging
- easier persistence and snapshotting
- easier simulation

## Validation And Discovery

Recommended direction:

- `validate()` receives a readonly hydrated root state facade
- `discover()` receives a readonly hydrated root state facade
- `execute()` receives a mutable hydrated root state facade

Reason:

- validation and discovery should not mutate state
- execution is the only phase that should mutate the working copy

## What This Design Does Not Change

This design does not require changing the `GameExecutor` runtime model.

The executor can continue to use:

- plain canonical state
- cloned working state
- deterministic runtime state
- command execution returning a new canonical state

The change is in:

- how the builder compiles game definitions
- how commands are wrapped
- what object is handed to the consumer during command execution

## Why This Direction Was Chosen

Compared with a fully reflective runtime-only approach, this design is better
because:

- metadata is compiled once at build time
- runtime behavior is more predictable
- the kernel preserves its current canonical-state architecture

Compared with requiring manual serializers/deserializers, this design is better
because:

- the consumer does not need excessive boilerplate
- the authoring model stays focused on game-domain objects

Compared with forcing all game logic into root-state methods, this design is
better because:

- state-local mutations still live close to the state they modify
- cross-cutting rule logic like card effects can stay outside the root state
- card games do not need a god-object root class for all effects

## Performance Tradeoff

This design improves the consumer authoring model, but it also introduces
facade-construction cost during command execution.

The main cost drivers are:

- cloning the canonical state
- walking large state graphs
- hydrating many facade objects
- eagerly wrapping large arrays or maps of substates

The facade layer should therefore be judged by a strict constraint:

- it is acceptable only if hydration overhead remains a small part of command
  execution cost

For most turn-based board games, a well-implemented facade layer should be
acceptable. For heavier games, eager hydration could become a noticeable source
of command latency.

So the decision boundary is:

- worth it if metadata is compiled once and facades are hydrated lazily
- not worth it if the design eagerly rebuilds large facade graphs every command

The preferred implementation direction is:

- compile metadata once at build time
- hydrate only the parts of the facade graph that execution actually touches
- avoid letting facade construction dominate total command latency

This tradeoff is considered acceptable because the authoring problem is not
cosmetic. Without a better state-authoring layer, complex games would quickly
degrade into large nested state interfaces and raw canonical-tree mutation.

So the current conclusion is:

- the facade model is worth pursuing
- but only under a performance discipline that keeps hydration overhead low
