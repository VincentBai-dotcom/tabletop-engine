# Visibility Projection Design

This document records the current implementation-scope design for visibility and
hidden information in `tabletop-kernel`.

The goal is to support viewer-specific state projection for frontend rendering
without changing the canonical authoritative state model.

## Goal

The kernel should support:

- one canonical authoritative state
- viewer-specific visible projections derived from that canonical state
- plain serializable visible output suitable for transport and frontend
  rendering
- strong consumer ergonomics for common hidden-information cases

The kernel should not require separate per-player state stores.

## Scope

The first visibility implementation covers only state projection.

In scope:

- viewer-specific projection of canonical state
- public vs hidden fields
- owner-relative field visibility
- automatic projection traversal
- custom state-level projection override hook

Out of scope for this first implementation:

- command discovery visibility
- event/log visibility
- replay-specific visibility
- pending-choice visibility

## Core Model

Visibility should be modeled as:

- canonical state in
- plain visible state out

The authoritative state remains:

```ts
{
  game: CanonicalGameState,
  runtime: RuntimeState
}
```

The visible projection should return:

```ts
{
  game: VisibleGameState,
  progression: ProgressionState
}
```

For the first implementation:

- include projected `game`
- include `progression` as-is
- exclude `rng`
- exclude `history`

## Viewer Identity

Visibility should use game-level viewer identity, not app-level user identity.

Illustrative shape:

```ts
type Viewer = { kind: "player"; playerId: string } | { kind: "spectator" };
```

The engine should reason in terms of:

- player
- spectator

It should not reason directly in terms of backend user ids.

## Default Projection Rules

The default projection path should be automatic.

The consumer should not need to write a root `getView(...)` function
just to activate visibility.

Automatic traversal should preserve the same structural shape by default:

- objects stay objects
- arrays stay arrays
- records stay records
- only hidden/private fields are transformed

So the default visible output remains structurally close to canonical state.

## Consumer Ergonomics

The intended consumer experience is:

- fields are public by default
- decorators are used only for non-public cases
- common hidden-information rules should require minimal code
- complex exceptions should use a state-level custom visibility hook

There should be no `@public` decorator.

## Decorators

### `@hidden`

Marks a field as hidden from all viewers.

### `@OwnedByPlayer()`

Marks a state class as establishing player ownership context.

Current rule:

- `@OwnedByPlayer()` uses `id` by convention as the owning player id
- the state must have a suitable non-empty `id` value

### `@visibleToSelf`

Marks a field as visible only to the owner player of the nearest owning
`@OwnedByPlayer()` ancestor.

Current rule:

- nearest `@OwnedByPlayer()` ancestor defines ownership
- if `@visibleToSelf` appears with no owning player ancestor, game-definition
  build should fail

## Hidden Envelope

When a field is hidden, the kernel should project it using a standard hidden
envelope.

Default hidden output:

```ts
{
  __hidden: true;
}
```

If a hidden field or self-visible field has a custom hidden summary payload, the
kernel should wrap it as:

```ts
{ __hidden: true, value: consumerPayload }
```

This keeps the frontend contract stable.

The consumer should not be responsible for adding the hidden marker manually.

## `@visibleToSelf` Hidden Behavior

For non-owners, `@visibleToSelf` should use the same hidden-envelope behavior as
`@hidden`.

That means:

- owner sees the real visible field
- non-owner sees:
  - `{ __hidden: true }`
  - or `{ __hidden: true, value: consumerPayload }`

## Complex Visibility Cases

Complicated visibility rules should not be solved by adding many special field
decorators.

Instead, the first implementation should support a custom visibility hook on a
state class.

That hook should:

- receive only `viewer`
- return the full visible replacement shape for that state
- fully replace the automatic projected shape for that state

It should not receive auto-projected child output in the first version.

## Consumer Example

### Simple owner-relative hidden information

```ts
@OwnedByPlayer()
@State()
class PlayerState {
  @field(t.string())
  id!: string;

  @field(t.number())
  score!: number;

  @visibleToSelf()
  @field(t.array(t.number()))
  hand!: number[];
}

@State()
class GameState {
  @field(
    t.record(
      t.string(),
      t.state(() => PlayerState),
    ),
  )
  players!: Record<string, PlayerState>;
}
```

Canonical state:

```ts
{
  game: {
    players: {
      p1: { id: "p1", score: 3, hand: [11, 12] },
      p2: { id: "p2", score: 2, hand: [21] }
    }
  },
  runtime: ...
}
```

Visible projection for viewer `p1`:

```ts
{
  game: {
    players: {
      p1: { id: "p1", score: 3, hand: [11, 12] },
      p2: { id: "p2", score: 2, hand: { __hidden: true } }
    }
  },
  progression: ...
}
```

### Complex case using a custom state visibility hook

Decks are a good example. The actual cards should remain hidden, but the
frontend often still wants to know how many cards remain.

Instead of storing a duplicated `deckSize` field in canonical state, the state
class should define a custom visibility hook.

```ts
@State()
class DeckState {
  @hidden()
  @field(t.array(t.number()))
  cards!: number[];

  projectCustomView(viewer: Viewer) {
    void viewer;

    return {
      cards: {
        __hidden: true,
        value: {
          count: this.cards.length,
        },
      },
    };
  }
}
```

This avoids:

- denormalized canonical state
- duplicated deck-size bookkeeping

while still giving the frontend useful visible information.

## Server Flow

The intended hosted flow is:

1. server loads canonical state
2. server executes command through the pure executor
3. server persists canonical next state
4. server calls visibility projection for each viewer
5. server sends projected visible state to each client

The server performs the filtering operation, but the filtering logic itself
belongs to the engine/kernel visibility system.

## Summary

The first visibility implementation should provide:

- one canonical state model
- automatic metadata-driven visibility projection
- plain visible output
- default-public fields
- `@hidden`
- `@OwnedByPlayer()`
- `@visibleToSelf`
- standard hidden envelopes
- state-level custom visibility hook for complex exceptions
