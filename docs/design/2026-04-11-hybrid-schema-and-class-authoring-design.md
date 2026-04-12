# Hybrid Schema And Class Authoring Design

## Problem

The current decorator-first state authoring model works well for runtime
behavior, but it does not fit TypeScript's static inference model well enough.

The main pain points are:

- exact canonical plain-data types are awkward to infer from decorators
- exact `getView(...)` return types cannot be inferred from visibility
  decorators alone
- the engine has added workaround helper types to compensate:
  - `CanonicalDataFromFacade<TFacade>`
  - `CanonicalGameStateOf<TGame>`
  - `CanonicalStateOf<TGame>`

Those helpers are not a good long-term design. They attempt to reconstruct exact
canonical types from facade class shape, but decorators are runtime metadata and
TypeScript cannot inspect them directly.

This becomes especially weak for visible state, where the runtime shape can be
transformed by:

- hidden envelopes
- self-visible unions
- custom projection hooks

If the engine should support this local development experience:

```ts
const nextState = gameExecutor.executeCommand(oldState, command).state;
const view = gameExecutor.getView(nextState, viewer);
```

with exact plain-object inference on both `nextState` and `view`, the authoring
model must make field shape and visibility visible to TypeScript.

## Decision

Move to a **hybrid schema-and-class authoring model**.

Under this model:

- schema objects become the source of truth for:
  - field shape
  - defaults
  - visibility
  - ownership
- classes remain the place for methods and game behavior
- `t(...)` remains a pure schema/type DSL
- `field(...)` becomes the state-field wrapper that adds state-specific metadata
- `t.state(...)` continues to reference nested state classes
- `createGameExecutor(...)`, `executeCommand(...)`, and `getView(...)` can
  infer exact plain-object types directly from the schema-authored game
  definition

This replaces the current attempt to infer canonical types from decorator
metadata.

## High-Level Authoring Experience

The intended authoring experience is:

1. define a typed state schema object
2. wrap each state field with `field(...)`
3. attach that schema to a class that owns methods
4. reference nested classes through `t.state(...)`
5. author defaults, visibility, and ownership in the schema

Example:

```ts
const SplendorPlayerSchema = defineStateSchema(
  {
    id: field(t.string()),
    tokens: field(t.state(() => TokenCountsState)),
    reservedCardIds: field(t.array(t.number()), {
      visibleToSelf: {
        summary: t.object({
          count: t.number(),
        }),
        derive: "summarizeReservedCards",
      },
      default: [],
    }),
    purchasedCardIds: field(t.array(t.number()), {
      default: [],
    }),
    nobleIds: field(t.array(t.number()), {
      default: [],
    }),
  },
  {
    ownedBy: "id",
  },
);

@State(SplendorPlayerSchema)
class SplendorPlayerState {
  awardNoble(nobleId: number) {
    this.nobleIds.push(nobleId);
  }

  reserveCard(cardId: number) {
    this.reservedCardIds.push(cardId);
  }

  summarizeReservedCards(value: number[]) {
    return { count: value.length };
  }
}
```

The schema object defines:

- canonical field shape
- runtime schema generation
- visible schema generation
- hidden/self-visible behavior
- default values
- ownership
- exact static inference

The class defines:

- methods
- invariants
- behavior

The class should not need to redeclare fields as class properties just to get
typing. `@State(schema)` should provide the schema-defined fields on `this`.

## `field(...)` vs `t(...)`

`t(...)` should remain a pure, reusable schema DSL.

That means it should still be valid for:

- command input
- discovery input
- runtime state
- protocol schemas

Visibility and defaults should not be pushed into `t(...)`, because those are
state-authoring concerns, not general schema concerns.

Recommended split:

```ts
const PlayerSchema = defineStateSchema(
  {
    id: field(t.string()),
    reservedCardIds: field(t.array(t.number()), {
      visibleToSelf: {
        summary: t.object({
          count: t.number(),
        }),
        derive: "summarizeReservedCards",
      },
      default: [],
    }),
  },
  {
    ownedBy: "id",
  },
);
```

So:

- `t(...)` = pure type/schema definition
- `field(...)` = state-only metadata:
  - `default`
  - `hidden`
  - `visibleToSelf`

This avoids bad cases like `t.hidden(...)` appearing in command-input schemas.

## Default Value Authoring Experience

Defaults should move into `field(..., config)`.

They should no longer live on class properties, because the class no longer
needs to redeclare the fields.

Example:

```ts
const SplendorPlayerSchema = defineStateSchema(
  {
    id: field(t.string()),
    tokens: field(t.state(() => TokenCountsState)),
    reservedCardIds: field(t.array(t.number()), {
      default: [],
    }),
    purchasedCardIds: field(t.array(t.number()), {
      default: [],
    }),
    nobleIds: field(t.array(t.number()), {
      default: [],
    }),
  },
  {
    ownedBy: "id",
  },
);
```

Rules:

- required non-`state` fields should provide an explicit default or be assigned
  during setup before validation
- `t.state(...)` should auto-instantiate nested state by default
- `t.optional(...)` should default to `undefined`
- if a required non-optional non-state field has no default and setup does not
  provide a value, runtime validation should fail

## Ownership Authoring Experience

`@OwnedByPlayer()` should become legacy in this model.

Ownership should move into schema metadata, not field metadata.

Recommended shape:

```ts
const SplendorPlayerSchema = defineStateSchema(
  {
    id: field(t.string()),
    reservedCardIds: field(t.array(t.number()), {
      visibleToSelf: {},
    }),
  },
  {
    ownedBy: "id",
  },
);
```

This means:

- the state node is owned by the player whose id is stored in field `id`
- `visibleToSelf` fields inside that subtree use that owner context

Ownership should stay schema-level rather than per-field, because a field-local
flag like `ownerIdentifier: true` creates ambiguous cases where zero or multiple
fields might be marked as the owner identifier.

The engine should validate ownership in two places:

- compile-time:
  - `ownedBy` must be one of the schema keys
  - the referenced field must use `t.string()`
- runtime:
  - the builder should still validate the resolved ownership metadata
    defensively

So these should fail:

```ts
defineStateSchema(
  {
    id: field(t.string()),
    score: field(t.number()),
  },
  {
    ownedBy: "playerId",
  },
);
```

and:

```ts
defineStateSchema(
  {
    owner: field(t.number()),
  },
  {
    ownedBy: "owner",
  },
);
```

## Nested State Authoring

`t.state(...)` still points at the nested state class.

Example:

```ts
const TokenCountsSchema = defineStateSchema({
  white: field(t.number(), { default: 0 }),
  blue: field(t.number(), { default: 0 }),
  green: field(t.number(), { default: 0 }),
  red: field(t.number(), { default: 0 }),
  black: field(t.number(), { default: 0 }),
  gold: field(t.number(), { default: 0 }),
});

@State(TokenCountsSchema)
class TokenCountsState {
  add(color: GemColor, amount: number) {
    this[color] += amount;
  }
}

const SplendorPlayerSchema = defineStateSchema({
  id: field(t.string()),
  tokens: field(t.state(() => TokenCountsState)),
});
```

This keeps the current good part of the class model:

- nested state still points at behavior-bearing classes

But it moves field shape into a TypeScript-visible schema object, which is the
part the current decorator model is missing.

## Visibility Authoring Experience

Visibility should move into `field(..., config)`, not into `t(...)`.

The engine should still own the hidden-envelope boilerplate. Developers should
not need to spell `__hidden: true` manually.

### Hidden Without Summary

```ts
const BoardSchema = defineStateSchema({
  deckByLevel: field(t.record(t.number(), t.array(t.number())), {
    hidden: {},
  }),
});
```

This means:

- canonical field type is the full deck structure
- visible field type is:

```ts
{
  __hidden: true;
}
```

The field should remain present in the visible object. It should not disappear
entirely.

### Hidden With Summary

```ts
const BoardSchema = defineStateSchema({
  deckByLevel: field(t.record(t.number(), t.array(t.number())), {
    hidden: {
      summary: t.object({
        1: t.number(),
        2: t.number(),
        3: t.number(),
      }),
      derive: "summarizeDeckByLevel",
    },
  }),
});
```

This means the visible field type is:

```ts
{
  __hidden: true;
  value: {
    1: number;
    2: number;
    3: number;
  };
}
```

### Visible To Self Without Summary

```ts
const PlayerSchema = defineStateSchema(
  {
    id: field(t.string()),
    reservedCardIds: field(t.array(t.number()), {
      visibleToSelf: {},
    }),
  },
  {
    ownedBy: "id",
  },
);
```

This means the visible field type is:

```ts
number[] | { __hidden: true }
```

### Visible To Self With Summary

```ts
const PlayerSchema = defineStateSchema(
  {
    id: field(t.string()),
    reservedCardIds: field(t.array(t.number()), {
      visibleToSelf: {
        summary: t.object({
          count: t.number(),
        }),
        derive: "summarizeReservedCards",
      },
      default: [],
    }),
  },
  {
    ownedBy: "id",
  },
);
```

This means the visible field type is:

```ts
number[] | {
  __hidden: true;
  value: {
    count: number;
  };
}
```

## Hidden Summary Derivation Logic

The derivation logic for hidden summaries should live on the class, not inline
inside `t(...)`.

Recommended shape:

```ts
const PlayerSchema = defineStateSchema(
  {
    id: field(t.string()),
    reservedCardIds: field(t.array(t.number()), {
      visibleToSelf: {
        summary: t.object({
          count: t.number(),
        }),
        derive: "summarizeReservedCards",
      },
      default: [],
    }),
  },
  {
    ownedBy: "id",
  },
);

@State(PlayerSchema)
class PlayerState {
  summarizeReservedCards(value: number[]) {
    return { count: value.length };
  }
}
```

The engine should still own the wrapper:

- if no summary is configured:
  - hidden result is `{ __hidden: true }`
- if summary is configured:
  - the derive method returns only the summary payload
  - the engine wraps it as `{ __hidden: true, value: payload }`

TypeScript should validate `derive` as a class method name with the correct
signature:

- method must exist
- method input must match the canonical field value
- method return type must match the summary schema

## Remove `projectCustomView()` Aggressively

The current class-level `projectCustomView()` escape hatch should be removed
aggressively rather than carried forward as a primary feature.

Why:

- field-level `hidden` and `visibleToSelf` on `field(t.state(...), config)` can
  already cover the normal “hide this whole nested subtree” case
- exact `getView(...)` inference is much easier when visibility stays inside the
  schema object
- class-level custom projection reintroduces runtime-only shape changes that are
  harder for TypeScript to see

So the intended direction is:

- keep field-level visibility as the normal hidden-information mechanism
- let a whole nested state be hidden by applying `hidden` or `visibleToSelf` to
  `field(t.state(...), config)`
- do not preserve `projectCustomView()` as a routine state-authoring feature

If a true whole-node shape replacement capability is still needed later, it
should be redesigned in a schema-visible way rather than carried forward from
the current decorator-era API.

## Ownership Resolution During View Projection

The runtime ownership rule should remain the same conceptually as today:

- while projecting the state tree, carry the current owner player id down the
  traversal
- when entering a state node with `ownedBy`, read that field from the current
  node
- that node becomes the new nearest owner context for its descendants
- `visibleToSelf` checks the viewer against that nearest owner context

Example:

```ts
const PlayerSchema = defineStateSchema(
  {
    id: field(t.string()),
    secretNotes: field(t.array(t.string()), {
      visibleToSelf: {},
      default: [],
    }),
    hand: field(t.state(() => HandState)),
  },
  { ownedBy: "id" },
);

const HandSchema = defineStateSchema({
  cards: field(t.array(t.number()), {
    visibleToSelf: {},
    default: [],
  }),
});
```

Here:

- `secretNotes` uses `PlayerSchema.id`
- `HandSchema.cards` also uses `PlayerSchema.id`, because `HandSchema` does not
  declare its own ownership

If a nested state declares its own `ownedBy`, that becomes the new nearest
owner for that subtree.

## Exact Inference Goal

With this model, the engine should be able to return exact plain-object types
directly.

That means:

```ts
const nextState = gameExecutor.executeCommand(oldState, command).state;
```

should infer:

- `nextState.game` as exact canonical plain data
- `nextState.runtime` as exact runtime state

And:

```ts
const view = gameExecutor.getView(nextState, viewer);
```

should infer:

- `view.game` as exact visible plain data
- `view.progression` as exact visible progression shape

This should work without:

- manual type annotations at the call site
- generated canonical helper types
- workaround facade-to-data helper types

## What Changes Compared To Today

### What Stays

- classes still exist
- methods still live on classes
- `t.state(...)` still references classes
- runtime validation still uses `t(...)`
- protocol / AsyncAPI generation still uses engine-owned schemas

### What Changes

- `@field(...)` no longer remains the long-term source of truth for field shape
- visibility is no longer authored primarily through decorators
- schema objects become the exact type-visible source of truth
- field defaults move out of class properties and into `field(..., config)`
- the engine no longer needs to approximate canonical data from facade class
  shape

## Why This Fits Better Than Pure Decorators

TypeScript can infer from:

- typed values
- function return types
- generic schema builders

TypeScript cannot infer exact field shape or visibility transforms from runtime
decorator metadata.

So if exact inference for both:

- `executeCommand(...)`
- `getView(...)`

is a hard requirement, the schema must become visible to TypeScript in normal
code.

This hybrid model gives that without giving up classes for behavior.

## Gap In Current Code

The current codebase still reflects the older decorator-driven workaround model.

### Legacy Canonical Helper Types

[state.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/types/state.ts)
still exports:

- `CanonicalDataFromFacade<TFacade>`
- `CanonicalGameStateOf<TGame>`
- `CanonicalStateOf<TGame>`

These exist only because the engine is still trying to reconstruct canonical
types from facade class shape.

### Builder Typing

[game-definition.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/game-definition.ts)
still wires `GameDefinitionBuilder` through
`CanonicalDataFromFacade<FacadeGameState>`.

This is a legacy approximation path that should disappear once schema objects
become the actual type surface.

### Example Consumer Code

[types.ts](/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor-terminal/src/types.ts)
still imports `CanonicalStateOf`.

That is part of the legacy model and should be removed after the engine adopts
hybrid schema authoring.

### Existing Decorator Visibility Model

The current visibility model in:

- [metadata.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/state-facade/metadata.ts)
- [project.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/state-facade/project.ts)

is runtime-correct, but it is not type-visible enough to support exact
`getView(...)` inference directly from the engine.

## Legacy Surface To Remove Later

After the engine migrates to hybrid schema authoring, the following legacy
surface should be removed:

### Engine Type Helpers

Remove:

- `CanonicalDataFromFacade`
- `CanonicalGameStateOf`
- `CanonicalStateOf`

from [state.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/types/state.ts)
and from
[index.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/index.ts).

### Builder Approximation Logic

Remove the `CanonicalDataFromFacade<FacadeGameState>` dependency from
[game-definition.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/game-definition.ts).

### Tests That Defend The Old Model

Rewrite or remove the canonical-helper expectations in
[types.test.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/tests/types.test.ts).

### Decorator-First State Authoring As The Primary Model

The current `@field(...)`, `@hidden(...)`, `@visibleToSelf(...)`, and
`@OwnedByPlayer()` model should become legacy once the schema-based hybrid model
is implemented.

Decorators may still exist as transitional compatibility or sugar, but they
should no longer be the primary long-term authoring path.

## Non-Goal

This design does **not** try to preserve exact `getView(...)` inference under
the existing pure-decorator model.

That path is intentionally being abandoned because it does not fit TypeScript's
static type system well enough.
