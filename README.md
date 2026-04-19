# tabletop-engine

Transport-agnostic runtime for board-game and tabletop rules engines.

This repo is a Bun workspace centered on the reusable engine package in
[`packages/tabletop-engine`](./packages/tabletop-engine), plus working example
games and clients.

## Current Status

The project is no longer just research or bootstrap code. The engine currently
implements:

- `GameDefinitionBuilder`
- `createGameExecutor(...)`
- command validation, execution, availability, and discovery
- progression lifecycle orchestration
- deterministic RNG
- decorator-authored state facades with `@State()`, `@field(...)`, and `t`
- hidden-information projection with `getView(...)`
- snapshots, replay helpers, and scenario testing
- protocol descriptor generation
- initial hosted AsyncAPI generation

## Workspace Layout

- [`packages/tabletop-engine`](./packages/tabletop-engine)
  reusable runtime package
- [`examples/splendor/engine`](./examples/splendor/engine)
  reference Splendor game built on the engine
- [`examples/splendor/terminal`](./examples/splendor/terminal)
  terminal client for exercising gameplay and discovery loops
- [`docs/design`](./docs/design)
  architectural decisions
- [`docs/plans`](./docs/plans)
  implementation plans and execution notes

## Current Deferrals

Not fully implemented yet:

- trigger engine
- stack / queue resolution
- richer event-resolution model
- persistence adapters
- richer hosted protocol beyond the current first AsyncAPI slice

## Common Commands

```bash
bun install
bun run lint
bun run typecheck
bun run test
```

Additional useful checks:

```bash
bun test --cwd examples/splendor/engine
bun test --cwd examples/splendor/terminal
```
