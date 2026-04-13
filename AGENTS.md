# tabletop-engine

## Purpose

`tabletop-engine` is a reusable, transport-agnostic runtime for board-game and
tabletop rules engines.

The repo is no longer in bootstrap stage. The engine package already supports a
working execution model that game packages can build on directly.

## Implemented Runtime Surface

Current implemented capabilities include:

- canonical `{ game, runtime }` state
- `GameDefinitionBuilder`
- `createGameExecutor(...)`
- command validation, execution, availability, and discovery
- deterministic RNG with persisted cursor state
- progression definition, normalization, and lifecycle hooks
- transactional execution against a cloned working state
- decorator-authored state facades via `@State()`, `@field(...)`, and `t`
- viewer-specific state projection through `getView(...)`
- visibility configuration through `configureVisibility(...)`, `hidden(...)`,
  and `visibleToSelf(...)`
- snapshots, replay helpers, and scenario-style test harness support
- protocol descriptor generation
- initial hosted AsyncAPI generation

## Repo Layout

Important workspace areas:

- `packages/tabletop-engine`
  the reusable engine package
- `examples/splendor`
  reference game built on the engine
- `examples/splendor-terminal`
  terminal client for exercising the hosted-style interaction loop locally
- `docs/design`
  current design decisions
- `docs/plans`
  implementation plans and historical execution notes

Inside the engine package:

- `src/runtime`
  command execution, progression orchestration, runtime events, transactions
- `src/state-facade`
  facade metadata, compilation, hydration, and visibility projection
- `src/schema`
  shared runtime schema API `t`
- `src/protocol`
  protocol descriptor and AsyncAPI generation

## Current Architectural Direction

Prefer explicit engine semantics over framework magic.

That currently means:

- keep authoritative canonical state separate from viewer-facing visible state
- let games author logic against facade classes while the executor still
  persists plain canonical data
- keep execution deterministic and replayable
- colocate runtime schemas with the game code that owns them
- keep transport decisions outside the core runtime, while still helping with
  protocol description and AsyncAPI generation

## Current Non-Goals

Still out of scope for the engine itself:

- web framework integration
- auth, lobby, matchmaking, or hosting product decisions
- persistence product decisions
- UI rendering concerns
- deployment assumptions

## Active Deferrals

The following are intentionally not complete yet:

- trigger engine
- stack / queue resolution model
- richer event-resolution model distinct from player-facing logs
- persistence adapters
- richer hosted protocol beyond the current initial AsyncAPI surface

## Guidance For Future Work

When editing this repo:

- preserve the public naming direction around `GameExecutor` and `GameEvent`
- avoid reintroducing vague low-level naming in the consumer-facing API
- keep the engine transport-agnostic even when adding protocol-generation help
- prefer plain serializable outputs for hosted/client-facing data
- treat examples as real consumer documentation, not throwaway code
- update design docs when architecture decisions change materially

## Verification

Common verification commands:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```
