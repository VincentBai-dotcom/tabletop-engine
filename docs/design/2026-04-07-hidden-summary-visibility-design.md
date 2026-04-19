## Purpose

Add hidden-summary support to the field-level visibility decorators so games can
project a player-safe replacement value for hidden or self-visible fields
without having to fall back to `projectCustomView(viewer)` at the whole-state
level.

This is primarily motivated by `examples/splendor`, where:

- `board.deckByLevel` should stay hidden, but clients still need deck counts
- `reservedCardIds` on `SplendorPlayerState` should be visible to the owner,
  while other viewers should still see a useful summary like card count

## Current Limitation

Today:

- `@hidden()` always projects `{ __hidden: true }`
- `@visibleToSelf()` shows the full value to the owner and the same hidden
  envelope to everyone else
- there is no supported way to attach a summary payload to that hidden envelope

So field-level visibility only supports:

- fully visible values
- fully hidden values

It does not support:

- hidden values with a transformed replacement summary

Games must currently use `projectCustomView(viewer)` to get that behavior, which
is heavier than necessary for cases where only a few fields need custom hidden
projection.

## Decision

Extend both field visibility decorators so they optionally accept hidden-summary
metadata.

Recommended public shape:

```ts
@hidden({
  schema: t.object({
    count: t.number(),
  }),
  project(value) {
    return {
      count: value.length,
    };
  },
})
field!: number[];
```

```ts
@visibleToSelf({
  schema: t.object({
    count: t.number(),
  }),
  project(value) {
    return {
      count: value.length,
    };
  },
})
field!: number[];
```

The existing no-arg usage remains valid:

```ts
@hidden()
field!: string;

@visibleToSelf()
field!: string;
```

## Hidden Envelope Semantics

If a hidden or self-visible field has no summary metadata, projection stays:

```ts
{
  __hidden: true;
}
```

If it has summary metadata, projection becomes:

```ts
{ __hidden: true, value: projectedSummary }
```

This applies to:

- every viewer for `@hidden(...)`
- non-owners for `@visibleToSelf(...)`

Owners of a `@visibleToSelf(...)` field still receive the real projected value,
not the hidden envelope.

## Decorator Metadata Shape

Field visibility metadata should grow from:

```ts
type FieldVisibilityMetadata = {
  mode: "hidden" | "visible_to_self";
};
```

to something like:

```ts
type HiddenSummaryProjector = (value: unknown) => unknown;

type FieldVisibilityMetadata = {
  mode: "hidden" | "visible_to_self";
  hiddenSummarySchema?: SerializableSchema;
  projectHiddenSummary?: HiddenSummaryProjector;
};
```

The projector should receive the raw canonical field value.

It should not receive the whole viewer or owning state context in the first
version. This keeps the API simple and focused on field-local transformations.

If a game needs viewer- or state-dependent hidden projection, it should still
use `projectCustomView(viewer)`.

## View Projection Behavior

When projecting a field:

1. determine whether the viewer should see the real value
2. if yes, project the real field value as normal
3. if no:
   - if no hidden-summary projector exists, emit `{ __hidden: true }`
   - if a hidden-summary projector exists, emit:
     `{ __hidden: true, value: projector(fieldValue) }`

The projector result must be plain serializable data.

Projection should not recursively apply state-facade visibility rules inside the
summary payload. The summary is already the final hidden replacement value.

## Protocol / View Schema Impact

This changes the visible-state schema surface.

If a field has hidden-summary metadata, the generated visible schema for that
field must allow the hidden envelope with a typed `value`.

Conceptually:

- without summary:
  - `{ __hidden: true }`
- with summary:
  - `{ __hidden: true, value: HiddenSummarySchema }`

For `@visibleToSelf(...)`, the visible schema must represent the union:

- real field shape
- or hidden envelope shape for non-owners

For `@hidden(...)`, the visible schema is always the hidden envelope shape, with
or without `value`.

### Ban `t.state(...)` In Projection Schemas

Hidden-summary schemas and custom view schemas should not allow `t.state(...)`.

Reason:

- projection/view schemas describe plain transport-visible data
- `t.state(...)` is the engine-specific extension for canonical state authoring
- projected views are not hydrated facade state

So the engine should enforce that hidden-summary schemas remain fully
serializable schemas only.

This should be enforced at the type level, not only by convention.

The current `SerializableSchema` type excludes `t.state(...)` only at the
top-level union, but nested composition still leaks through because `t.object`,
`t.array`, `t.record`, and `t.optional` currently accept broad `FieldType`
inputs.

Recommended follow-up:

- introduce a recursive serializable field type that excludes `NestedStateFieldType`
- use that stricter type for:
  - `@viewSchema(...)`
  - `@hidden({ schema })`
  - `@visibleToSelf({ schema })`
- keep a defensive runtime/protocol validation error as a backstop

## Boundary With `projectCustomView(viewer)`

This feature is intentionally narrower than `projectCustomView(viewer)`.

Use decorator hidden summaries when:

- the visible game shape still mostly matches canonical facade shape
- only a few fields need hidden replacement data

Use `projectCustomView(viewer)` when:

- the whole visible state shape is meaningfully different
- hidden replacement depends on broader state context or the viewer
- the consumer UI wants a custom root-level view contract

## Example: Splendor

With this API, Splendor can stay in the field-level visibility model:

- `SplendorPlayerState` marked with `@OwnedByPlayer()`
- `reservedCardIds` marked with `@visibleToSelf(...)`
  - owners see the real card ids
  - others see `{ __hidden: true, value: { count: number } }`
- `board.deckByLevel` marked with `@hidden(...)`
  - all viewers see `{ __hidden: true, value: { 1: number, 2: number, 3: number } }`

That lets `examples/splendor/terminal` render only `executor.getView(...)`
output while still showing the information a real player client needs.

## Non-Goals

Not part of this change:

- viewer-dependent hidden-summary projectors
- state-context-aware hidden-summary projectors
- recursive schema projection inside summary payloads
- replacing `projectCustomView(viewer)`

## Recommended Implementation Order

1. Extend field visibility metadata to store optional summary schema and
   projector
2. Update `@hidden(...)` and `@visibleToSelf(...)` signatures
3. Update runtime view projection to emit hidden envelopes with `value`
4. Update visible schema generation to include summary payloads
5. Add engine tests for:
   - `@hidden()` without summary
   - `@hidden(...)` with summary
   - `@visibleToSelf()` without summary
   - `@visibleToSelf(...)` with summary
6. Update `examples/splendor/engine` to use field-level visibility decorators
7. Update `examples/splendor/terminal` to render only `getView(...)`
