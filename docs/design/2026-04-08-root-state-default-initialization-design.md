# Root State Default Initialization Design

## Problem

The current authoring model has an awkward split:

- `rootState(...)` defines the state shape through decorated state classes
- `initialState(...)` provides the initial canonical state value
- `setup(...)` mutates that initial state procedurally

This creates two problems:

1. it gives games two overlapping initialization paths
2. it pushes consumers toward constructing state-class instances as canonical
   state, which conflicts with the engine rule that canonical state should
   remain plain serializable data

The Splendor example exposes the tension clearly:

- the state classes already define the full structural shape
- but the game still needs to author `createInitialGameState(...)`
- and that setup path currently returns state-class instances rather than plain
  canonical data

That is the wrong authoring model.

The state classes should remain the single source of truth for structure, and
the engine should be responsible for deriving plain canonical initial state
from them.

## Direction

The engine should build the initial canonical state from the `rootState(...)`
definition itself.

That means:

- `initialState(...)` should be removed from normal game-definition authoring
- `setup(...)` becomes the only game-definition hook for initialization logic
- decorated field initializers on state classes become the default-value source
- the engine synthesizes a plain canonical state tree from the root state class
  before `setup(...)` runs

Example authoring direction:

```ts
@State()
class SplendorPlayerState {
  @field(t.string())
  id!: string;

  @field(t.array(t.number()))
  reservedCardIds: number[] = [];

  @field(t.array(t.number()))
  purchasedCardIds: number[] = [];

  @field(t.array(t.number()))
  nobleIds: number[] = [];
}
```

```ts
new GameDefinitionBuilder("splendor")
  .rootState(SplendorGameState)
  .setup(({ game, rng, playerIds }) => {
    // player ids, shuffled decks, bank counts, etc.
  });
```

## Why This Is Better

### One source of truth

The state classes already define:

- field names
- nested state relationships
- collection shapes

Initial values should come from those same classes, not from a second plain
object builder.

### No duplicated initialization model

Removing `initialState(...)` from game-definition authoring avoids the current
split between:

- declarative initial object creation
- imperative setup mutation

The game definition should have one initialization model:

- engine creates default canonical state from `rootState(...)`
- `setup(...)` mutates it as needed

### Canonical state stays plain

The engine should not persist or return hydrated facade instances as canonical
state.

Instead:

1. instantiate the decorated root state class only as a temporary authoring
   object
2. recursively read its initialized field values
3. dehydrate that object graph into plain canonical data
4. run `setup(...)` against hydrated facades over that plain backing state

So the engine preserves:

- state-class authoring ergonomics
- plain serializable canonical state

## Engine Behavior

### 1. Require `rootState(...)`

If the engine is expected to synthesize initial state, then `rootState(...)`
becomes mandatory.

Games without a root decorated state class should not use this path.

### 2. Instantiate the root state class

The engine creates:

```ts
const root = new RootState();
```

This allows field initializers to run naturally.

### 3. Materialize field defaults and validate missing values

For every decorated field reachable from the root:

- if the field already has a concrete initialized value, use it
- if the field is a nested `t.state(...)` field and is still `undefined`,
  instantiate that nested state class and continue
- if the field is `t.optional(...)` and is still `undefined`, keep
  `undefined`
- if the field is any other non-`state` field and is still `undefined`, throw

This means regular fields should define defaults directly:

```ts
@field(t.array(t.number()))
reservedCardIds: number[] = [];
```

And nested state fields can be left unset:

```ts
@field(t.state(() => TokenCountsState))
tokens!: TokenCountsState;
```

If a developer explicitly initializes a nested state field, the engine should
respect it:

```ts
@field(t.state(() => TokenCountsState))
tokens = new TokenCountsState();
```

But it should not be required. Missing nested state fields should be
auto-instantiated by the engine.

This is effectively runtime validation during default-state synthesis:

- `t.state(...)` missing: auto-create
- `t.optional(...)` missing: allow `undefined`
- any other field missing: fail fast

### 4. Dehydrate to plain canonical data

After the temporary state-instance tree exists, the engine should recursively
convert it to plain data:

- primitive fields become primitive values
- nested state instances become plain objects
- arrays become plain arrays
- records become plain objects
- object fields become plain objects
- methods and prototypes are discarded

This dehydration step is the canonical boundary.

The stored and returned state must be plain serializable data.

### 5. Run `setup(...)`

Once the plain canonical state exists, the engine hydrates facades over that
backing state and runs `setup(...)`.

That preserves the current consumer experience:

- game setup code can still call state methods
- setup mutation still writes into plain canonical backing data

### 6. Return canonical state

`createInitialState()` returns:

- plain `{ game, runtime }`
- not state-class instances

## Authoring Rules

### Field initializers define defaults

Developers should set default values directly on decorated fields whenever a
reasonable default exists.

Examples:

```ts
@field(t.array(t.number()))
reservedCardIds: number[] = [];

@field(t.array(t.string()))
playerOrder: string[] = [];
```

### Nested `t.state(...)` fields do not need explicit defaults

Nested state fields may be left unset:

```ts
@field(t.state(() => TokenCountsState))
tokens!: TokenCountsState;
```

The engine should auto-instantiate them during default-state synthesis.

If the developer explicitly assigns a nested state instance, the engine should
honor that value instead of replacing it.

### Constructors should not be the source of initialization semantics

The engine will instantiate decorated state classes to read field defaults, but
constructors should not be treated as the authoritative source of state
initialization logic.

The intended authoring surface is:

- field initializers for non-`state` defaults
- optional explicit nested state instances
- `setup(...)` for dynamic initialization

If a constructor mutates fields, the engine will observe the resulting values,
but constructors should not be relied on for primary initialization behavior.

### `setup(...)` handles dynamic initialization

Use `setup(...)` for:

- player-dependent data
- RNG-dependent setup
- deck shuffling
- initial market fill
- assigning ids or other runtime-dependent values

### Tests and scenarios bypass setup entirely

Scenario and replay helpers should continue to accept canonical state directly.

They do not need a game-definition `initialState(...)` escape hatch.

## Non-Goals

This design does not require:

- typed automatic inference of the exact canonical plain-data TypeScript type
  from the state classes yet
- custom serialization hooks
- support for arbitrary non-decorated class instances inside canonical state

## Open Questions

### Should nested `t.state(...)` fields auto-instantiate?

Decision:

- yes, missing nested `t.state(...)` fields should auto-instantiate
- explicit nested state initializers should still be respected if present

### What happens when a regular field has no default?

Decision:

- `t.optional(...)` may remain `undefined`
- any other non-`state` field left `undefined` should throw during initial-state
  synthesis

### When should the engine run this validation?

Decision:

- during default-state synthesis before `setup(...)`
- again after `setup(...)`, before `createInitialState()` returns

### Should `rootState(...)` become mandatory?

If `initialState(...)` is removed from normal game-definition authoring, then
yes:

- a game must provide `rootState(...)`
- otherwise the engine has no structural source of truth to synthesize from

## Recommendation

Adopt this initialization model:

- remove `initialState(...)` from game-definition authoring
- require `rootState(...)`
- synthesize initial canonical state from decorated field initializers and
  auto-instantiated nested state fields
- dehydrate state-class instances into plain canonical data internally
- keep `setup(...)` as the only game-definition initialization hook

This gives the cleanest authoring model:

- one structural source of truth
- one initialization hook
- plain canonical persistence
- no duplicated plain-object setup definitions
