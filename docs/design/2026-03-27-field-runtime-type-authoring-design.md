# Field Runtime Type Authoring Design

## Purpose

This document records a refinement of the state-facade authoring model in
`tabletop-kernel`.

The previous direction used:

- `@State()` on state classes
- per-field decorators like `@scalar()` and `@state(...)`

That solved the runtime metadata problem, but it still left field authoring too
fragmented and too narrow for future validation and collection support.

The new goal is to move field authoring to a single runtime-type-based field
decorator:

```ts
@State()
class PlayerState {
  @field(t.number())
  health!: number;

  @field(t.state(() => HandState))
  hand!: HandState;

  @field(t.array(t.state(() => CardState)))
  cards!: CardState[];
}
```

## Problem

The kernel needs runtime-visible field metadata for the state-facade system.
TypeScript field types alone are not enough because they are not reliably
available at runtime.

The current decorator model works, but it has three shortcomings:

1. it separates structure kinds into many ad hoc decorators
2. it does not compose well for arrays, records, or future nested structures
3. it has no natural place to attach runtime validation rules later

The field authoring model should remain:

- explicit
- runtime-visible
- composable
- extendable to validation

## Chosen Direction

The chosen direction is:

- keep `@State()` for state classes
- replace field-specific decorators with a single `@field(...)` decorator
- pass a kernel-owned runtime field type object into `@field(...)`
- provide a small composable type builder namespace, initially named `t`

The target consumer experience is:

```ts
@State()
class PlayerState {
  @field(t.number())
  health!: number;

  @field(t.state(() => HandState))
  hand!: HandState;

  @field(t.array(t.state(() => CardState)))
  cards!: CardState[];
}
```

## Runtime Type Builder

The kernel should provide a composable field type builder, initially exposed as
`t`.

The first required runtime field types are:

- `t.number()`
- `t.string()`
- `t.boolean()`
- `t.state(() => NestedState)`
- `t.array(itemType)`
- `t.record(keyType, valueType)`

This is enough to model:

- scalar fields
- singular nested state fields
- arrays of plain data
- arrays of nested state
- record-shaped collections

The runtime type builder is kernel-owned metadata. It is not meant to expose
arbitrary user-defined validators yet.

## Why This Is Better

This is better than many field decorators because:

- there is one field decorator shape
- nested collections become composable
- field metadata becomes easier to extend later
- validation can be attached to field types without changing the top-level
  authoring model

This is also better than inference-only approaches because:

- empty arrays and empty objects remain well-defined
- nested state targets are explicit
- the builder does not need to guess collection element types from runtime data

## Relation To Validation

The runtime type builder is also the right place to attach validation later.

Example future directions:

```ts
@field(t.number().min(0).max(20))
health!: number;

@field(t.array(t.state(() => CardState)).maxLength(10))
cards!: CardState[];
```

That means field metadata can eventually serve both:

- hydration/traversal
- optional runtime validation

This design does not require validation to be implemented immediately.

## State Boundary Rules

The state boundary remains:

- `@State()` marks a class as a kernel-recognized state facade type
- only fields described through `@field(...)` metadata are part of the
  state-facade field graph
- arbitrary helper or utility class instances should not live in persistent
  match state by default

Cross-state rule logic still belongs outside persistent state when appropriate,
for example in immutable card-definition or effect registries.

## Execution Model

This design does not change the already chosen execution model:

- canonical stored state remains plain data
- the executor clones canonical state into a working copy
- the hydrator creates a root facade object over that working copy
- nested state objects are hydrated lazily on access
- commands and progression hooks operate on the hydrated facade
- the executor still returns plain canonical state

So this design changes the authoring metadata model, not the reducer-style
external execution contract.

## Migration Direction

The implementation should migrate in small steps:

1. add `@field(...)` and `t`
2. teach compile/hydrate to use runtime field types
3. preserve temporary compatibility with `@scalar()` / `@state(...)`
4. migrate Splendor state classes to `@field(t...)`
5. remove legacy field decorators after all in-repo consumers are moved

This keeps the branch executable while the new authoring model lands.
