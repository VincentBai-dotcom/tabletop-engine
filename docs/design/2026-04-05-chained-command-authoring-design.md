# Chained Command Authoring Design

## Status

Accepted as the new desired command-authoring experience.

This document is a focused follow-up to
[`2026-03-31-command-factory-migration-design.md`](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-03-31-command-factory-migration-design.md).

It does not replace the earlier migration direction. It refines the consumer
authoring API from a one-shot object literal into a chained builder.

## Problem

The current command factory solves one major issue from the old class-based API:

- the engine supplies method input types automatically
- `FacadeGameState` is bound once in `createCommandFactory(...)`
- command input and discovery input are inferred from their schemas

However, the current one-shot object-literal experience still has a real editor
problem while a developer is in the middle of typing.

Example:

- `commandId` and `commandSchema` may already be written
- `validate`, `execute`, or `discover` may not be written yet
- while the object literal is incomplete, TypeScript / VS Code reports that the
  config is invalid

This is not mainly an ESLint problem. It is a TypeScript-language-service
problem caused by validating a partially written object literal against a
strict command config shape.

The result is a noisy authoring experience even though the final API is more
ergonomic than the old class-based approach.

## Goal

Preserve all the benefits of the factory-based command API while improving the
authoring experience during editing.

Required properties of the new authoring model:

- bind `FacadeGameState` once at the factory level
- infer command input from `commandSchema`
- infer discovery input from `discoverySchema`
- keep command lifecycle method parameters supplied by the engine
- avoid the large incomplete object-literal validation problem
- allow optional steps to be authored in a natural order
- provide an explicit finalization point

## Decision

Move command authoring to a chained builder API with `.build()`.

`discoverable(...)` should be the only way to add discovery support.

This means the desired authoring shape is no longer:

```ts
defineSplendorCommand({
  commandId: "take_gems",
  commandSchema: takeGemsSchema,
  discoverySchema: takeGemsDiscoverySchema,
  discover(...) { ... },
  isAvailable(...) { ... },
  validate(...) { ... },
  execute(...) { ... },
});
```

It should become a staged builder instead.

## Recommended Consumer Experience

```ts
const defineSplendorCommand = createCommandFactory<SplendorGameState>();

export const takeThreeDistinctGemsCommand = defineSplendorCommand({
  commandId: "take_three_distinct_gems",
  commandSchema: takeThreeDistinctGemsCommandSchema,
})
  .discoverable({
    discoverySchema: takeThreeDistinctGemsDiscoverySchema,
    discover({ game, runtime, discovery }) {
      return {
        complete: true,
        input: {
          colors: discovery.input?.selectedColors ?? [],
        },
      };
    },
  })
  .isAvailable(({ game, runtime }) => {
    void runtime;
    return game.board.canTakeThreeDistinctGems();
  })
  .validate(({ game, command }) => {
    void game;
    void command;
    return { ok: true };
  })
  .execute(({ game, command, emitEvent }) => {
    void emitEvent;
    game.takeThreeDistinctGems(command.input?.colors ?? []);
  })
  .build();
```

And for a non-discoverable command:

```ts
export const passTurnCommand = defineSplendorCommand({
  commandId: "pass_turn",
  commandSchema: passTurnCommandSchema,
})
  .validate(({ game, command }) => {
    void game;
    void command;
    return { ok: true };
  })
  .execute(({ game }) => {
    game.passTurn();
  })
  .build();
```

## Why `.build()` Is Desired Here

Unlike the game definition builder, a command definition is smaller, so a
one-shot object literal is technically possible.

However, `.build()` is still desirable here for editor UX.

It gives:

- a stable explicit finalization point
- a place for builder-time validation
- freedom to allow optional chain steps in a flexible order
- less pressure to make incomplete intermediate states satisfy the final
  command-definition type too early

Without `.build()`, the chain tends to become more order-constrained or the
type layer becomes more awkward.

## Why `discoverable(...)` Is The Only Discovery Entry Point

The builder should not have both:

- `.discoverable(...)`
- `.nonDiscoverable()`

The non-discoverable path should simply be the default.

Reasoning:

- commands without discovery are the simpler baseline
- adding a special non-discoverable step adds ceremony without adding meaning
- discovery is the exceptional capability that needs an explicit step

So:

- no discovery support unless `.discoverable(...)` is called
- if `.discoverable(...)` is called, the builder must require:
  - `discoverySchema`
  - `discover(...)`

## Builder Responsibilities

The chained builder should carry type information forward across steps.

At minimum:

1. `createCommandFactory<FacadeGameState>()`
   binds the game-state type once
2. `defineCommand({ commandId, commandSchema })`
   infers `TCommandInput`
3. `.discoverable({ discoverySchema, discover })`
   infers `TDiscoveryInput`
4. `.isAvailable(...)`
   receives `CommandAvailabilityContext<FacadeGameState>`
5. `.validate(...)`
   receives `ValidationContext<FacadeGameState, CommandFromSchema<TCommandInput>>`
6. `.execute(...)`
   receives `ExecuteContext<FacadeGameState, CommandFromSchema<TCommandInput>>`
7. `.build()`
   returns the final branded command definition

The key requirement is that this should preserve the current inference quality,
not reduce it.

## Ordering Expectations

The builder should support a natural flexible order for optional steps.

Desired:

```ts
defineCommand(...)
  .isAvailable(...)
  .discoverable(...)
  .validate(...)
  .execute(...)
  .build();
```

and also:

```ts
defineCommand(...)
  .discoverable(...)
  .validate(...)
  .execute(...)
  .build();
```

and:

```ts
defineCommand(...)
  .validate(...)
  .execute(...)
  .build();
```

The important rule is not chain order. The important rule is:

- the builder must not allow `.build()` until all required lifecycle methods
  for the chosen path are present

At minimum:

- `validate(...)` required
- `execute(...)` required
- if discoverable:
  - `discoverable(...)` required before build completes

## Recommendation On Final Shape

The final built value should still be the same runtime command object shape the
engine already operates on.

That means the chained builder is an authoring-layer improvement, not a
runtime-contract redesign.

The built command should still expose the same final fields:

- `commandId`
- `commandSchema`
- optional `discoverySchema`
- optional `discover`
- optional `isAvailable`
- required `validate`
- required `execute`

So the runtime, executor, protocol descriptor, and AsyncAPI generator should
not need structural redesign just because the authoring API became chained.

## Comparison With The Current Object-Literal Factory

### Current One-Shot Factory

Pros:

- simple implementation
- strong inference
- same runtime shape directly

Cons:

- editor errors while the object is still incomplete
- discoverable vs non-discoverable typing is harder to present cleanly while
  typing
- worse live authoring experience even if final types are correct

### Chained Builder

Pros:

- better live editing experience
- explicit staging of command authoring
- flexible optional steps
- easier to make incomplete intermediate states valid
- clear finalization point via `.build()`

Cons:

- more type plumbing in the engine
- more builder implementation work
- slightly more ceremony than a one-shot object literal

The tradeoff is worth it.

## Migration Direction

The desired direction is:

- keep command authoring factory-based
- replace the one-shot command config with a chained builder
- do not preserve the old one-shot consumer API for backward compatibility if
  it gets in the way

This remains aligned with the broader command-authoring direction:

- class-based command authoring stays removed
- manual method parameter typing stays removed
- the engine remains responsible for command lifecycle context types

## Non-Goals

This document does not yet lock:

- the exact builder type names
- whether `.validate(...)` and `.execute(...)` can appear in any order or only
  a limited set of orders
- whether there should be helper shortcuts for common command shapes
- the exact migration sequence from the current `defineCommand({...})` API

Those should be decided in a follow-up implementation plan.
