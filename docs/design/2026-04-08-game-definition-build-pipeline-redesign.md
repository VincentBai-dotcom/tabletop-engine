# Game Definition Build Pipeline Redesign

## Purpose

This document records the next expected behavior of
`GameDefinitionBuilder.build()` once the engine starts treating the decorated
state graph as the single source of truth for:

- facade hydration
- canonical plain-state typing
- canonical plain-state validation
- initial-state synthesis
- snapshot validation

It also records what `GameDefinitionBuilder.build()` does today, so the gap is
explicit.

## Problem

The engine already compiles the reachable `@State()` graph from `rootState(...)`
for hydration and visibility projection.

But it does **not** yet compile that same state graph into:

- one canonical plain game-state schema
- one canonical plain-state type surface for consumers
- one schema-backed runtime validation path for canonical game state
- one schema-backed runtime validation path for engine runtime state

That creates a mismatch:

- the engine structurally knows the state graph
- but consumer typing still leaks or guesses at canonical state shape
- and runtime canonical-state validation does not yet exist

The Splendor terminal example exposed the typing side of this problem:

- `executeCommand(...).state.game` should be plain canonical data
- but there is no clean engine-owned type surface for that canonical plain data

## Direction

`GameDefinitionBuilder.build()` should compile the decorated root state into a
full canonical schema artifact in addition to the existing facade metadata.

That compiled artifact should later support:

- runtime validation of canonical state values
- default initial-state synthesis
- snapshot validation
- clearer canonical-state typing for consumers

The root state class remains the source of truth.

The engine should not ask games to manually define a second plain canonical
schema by hand.

## Current `build()` Behavior

Today `GameDefinitionBuilder.build()` does the following:

1. validate that `initialState` exists
2. validate that `initialStage` exists
3. collect all reachable stages starting from the initial stage
4. compile the command map from reachable stages
5. if `rootState(...)` exists, compile reachable state-facade metadata from the
   decorated root state graph
6. return a `GameDefinition` containing:
   - `name`
   - `initialState`
   - `commands`
   - `stateFacade`
   - `initialStage`
   - `stages`
   - `rngSeed`
   - `setup`

Notably, it does **not** currently:

- require `rootState(...)`
- produce a canonical plain game-state schema
- define a canonical game-state validation path from compiled schema metadata
- synthesize default canonical game state from field defaults
- validate snapshots or externally supplied canonical game state against the
  state graph

## Expected Future `build()` Behavior

Once the redesign is implemented, `GameDefinitionBuilder.build()` should do the
following:

### 1. Validate builder prerequisites

The builder should validate:

- `rootState(...)` is present
- `initialStage(...)` is present

Under this direction, `initialState(...)` is no longer the normal authoring
path and should be removed from game-definition authoring.

### 2. Compile reachable stage graph

The builder should:

- collect all reachable stages from `initialStage`
- detect duplicate stage ids
- compile the reachable command map from those stages
- detect duplicate command ids

This stays the same in spirit as today.

### 3. Compile reachable facade metadata

From `rootState(...)`, the builder should continue compiling:

- reachable state classes
- field metadata
- ownership/visibility metadata
- custom view metadata

This is the existing state-facade compilation step.

### 4. Compile one canonical root schema

From that same reachable state graph, the builder should recursively assemble a
single canonical plain-data schema for the root game state.

Conceptually, the result should be equivalent to:

```ts
t.object({
  playerOrder: t.array(t.string()),
  players: t.record(
    t.string(),
    t.object({
      id: t.string(),
      reservedCardIds: t.array(t.number()),
      ...
    }),
  ),
  bank: t.object({
    white: t.number(),
    ...
  }),
  ...
})
```

This schema is not authored by the consumer directly. It is derived from the
decorated state graph.

### 5. Use the canonical game-state schema for runtime validation

From the canonical game-state schema, the engine should later validate:

- synthesized canonical game state
- the `state.game` subtree passed into `executeCommand(...)`
- snapshots restored from storage
- scenario/test fixtures when validation is requested

This validation should operate on plain canonical data, not hydrated facade
instances.

The important artifact is the giant canonical game-state `t.object(...)` schema
itself. The engine can recursively validate against that schema directly.

If a precompiled validator function is ever added later, that should be treated
as an optimization detail, not as a separate required design concept.

### 6. Assemble an engine-owned runtime schema

The builder should also assemble the schema used to validate
`state.runtime`.

This runtime schema is partly engine-owned and partly game-authored:

- the engine owns the fixed runtime shape for:
  - `progression`
  - `rng`
  - `history`
  - stage-kind-specific runtime fields such as:
    - `activePlayerId`
    - `activePlayerIds`
    - `lastActingStage`
- the game owns any `memory` schema used by reachable
  `multiActivePlayer` stages

This means the builder should plug each reachable multi-active stage's memory
schema into the engine-owned runtime schema. The builder should not treat
multi-active memory as `unknown`.

This also means the multi-active stage authoring API must capture runtime
schema, not only a TypeScript type parameter.

The older shape:

```ts
.memory<T>(() => initialMemory)
```

is not sufficient, because it does not provide a runtime artifact that can be
used for snapshot validation or runtime-state validation.

The memory API should instead capture both:

- a `t.*` schema for runtime validation
- an initializer for default memory value

That memory schema should follow the same rules as command input and discovery
input schemas:

- no `t.state(...)`
- top-level schema must be `t.object(...)`

The engine should reuse the same serializable-schema validation path for this
memory schema surface rather than introducing a separate validator concept.

Conceptually:

```ts
.memory(
  t.object({
    submittedByPlayerId: t.record(t.string(), t.boolean()),
  }),
  () => ({
    submittedByPlayerId: {},
  }),
)
```

The result is:

- `state.game` validates against `canonicalGameStateSchema`
- `state.runtime` validates against an engine-owned runtime schema that
  includes game-authored multi-active memory shapes where relevant

### 7. Derive one `defaultCanonicalGameState`

From the decorated root state class and compiled facade metadata, the builder
should derive one plain `defaultCanonicalGameState` value by:

1. instantiate the root state class temporarily
2. recursively read field defaults
3. auto-instantiate missing nested `t.state(...)` fields
4. allow missing `t.optional(...)` fields as `undefined`
5. fail on other missing required fields
6. dehydrate the resulting object graph into plain canonical data

This plain canonical state becomes the initial base state before
`setup(...)`.

The builder does not need to generate or store a special synthesizer function.
It can simply compute `defaultCanonicalGameState` once at build time.

### 8. Compile canonical type surfaces

The builder should also expose type surfaces derived from the compiled root
schema.

There are two related needs:

1. the canonical plain **game** data shape
2. the full canonical **`{ game, runtime }`** state shape that consumers pass
   to `executeCommand(...)` and receive back from the executor

The exact TS API can vary, but the intended outcome is:

- consumers can cleanly refer to the canonical plain game-data shape of a built
  game
- consumers can also cleanly refer to the full `CanonicalState` shape for that
  game, including engine runtime state
- they do not need to guess either shape from facade classes
- they do not need to manually define second canonical types

The runtime half of the full `CanonicalState` remains engine-owned, but the
engine should still expose a full inferred state type surface for consumer DX.

These type surfaces are DX goals. They are not required for runtime validation
itself, but they should come from the same compiled schema artifact plus the
existing engine runtime-state model.

### 9. Return a richer `GameDefinition`

The built game definition should eventually carry:

- `name`
- `commands`
- `initialStage`
- `stages`
- `rngSeed`
- `setup`
- `stateFacade`
- `canonicalGameStateSchema`
- `defaultCanonicalGameState`
- enough information to assemble runtime-state validation, including reachable
  multi-active memory schemas
- canonical type helpers for:
  - canonical game data
  - full `CanonicalState<{ game, runtime }>`

The exact property names can vary, but those compiled artifacts should exist
internally.

## Expected `createInitialState()` Runtime Flow

Given the richer build output, `createGameExecutor(...).createInitialState()`
should later behave like this:

1. create empty runtime state
2. clone `defaultCanonicalGameState` from the built game definition
3. validate that cloned canonical game state against
   `canonicalGameStateSchema`
4. hydrate facades over that canonical game backing state
5. run `setup(...)` if present
6. validate the final canonical game state again
7. initialize the stage machine
8. validate the resulting runtime state against the engine-owned runtime schema
9. return plain canonical `{ game, runtime }`

## Expected `executeCommand()` Runtime Validation Flow

Later, when full canonical-state runtime validation is added, the expected flow
for `executeCommand(state, command)` becomes:

1. validate the incoming canonical `state.game` against
   `canonicalGameStateSchema`
2. validate the incoming `state.runtime` against the engine-owned runtime
   schema, including any reachable multi-active memory shapes
3. validate the command envelope and command input as today
4. clone canonical `{ game, runtime }` state
5. hydrate facades
6. run validation/execution/stage logic
7. validate the resulting canonical game state again before returning

This ensures snapshots or external persistence cannot drift silently from the
declared state model.

## Why The Compiled Root Schema Matters

Compiling one canonical game-state root schema solves multiple problems at
once:

- one source of truth for canonical shape
- runtime validation for canonical game data inside snapshots and executor
  inputs
- future static canonical typing for both:
  - canonical game data
  - full executor state
- cleaner default game-state synthesis
- clearer separation between:
  - canonical plain game data
  - temporary hydrated facade objects

Without this compiled schema, each of those concerns must either:

- be implemented separately
- or rely on looser inferred/guessed types

## Recommendation

The engine should extend `GameDefinitionBuilder.build()` from:

- stage compilation
- command compilation
- facade metadata compilation

into a fuller compile step that also produces:

- canonical game-state root schema
- `defaultCanonicalGameState`
- canonical type surfaces for game and full executor state

This is the right place to do it because `build()` is already the one moment
where the engine has:

- the root decorated state graph
- the full reachable stage graph
- the complete command graph

That makes it the natural compilation boundary for both runtime execution and
typing artifacts.
