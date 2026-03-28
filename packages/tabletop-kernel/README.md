# tabletop-kernel

Reusable runtime kernel package for tabletop and board-game rules engines.

## Current scope

This package currently provides a runtime skeleton with:

- canonical `{ game, runtime }` state types
- command definitions with `validate` and `execute`
- decorator-driven state facade metadata via `@State()`, `@field(...)`, and `t`
- `rootState(...)` authoring on `GameDefinitionBuilder`
- hydrated state facades for command execution, validation, availability, and discovery
- transactional command execution
- nested progression definitions with kernel-managed lifecycle resolution
- semantic event collection
- deterministic RNG primitives
- snapshot and replay helpers
- a small scenario-style test harness

## Intentional deferrals

The current package does **not** yet implement:

- a first-class visibility / hidden-information subsystem
- a first-class public internal-step abstraction
- rich trigger resolution beyond the current skeleton
- richer stack / queue resolution models

## Scripts

```bash
bun run test
bun run typecheck
```

## State facade authoring

Games can continue to persist and execute against plain canonical state, while
authoring against a decorated root facade class.

```ts
@State()
class CounterState {
  @field(t.number())
  value!: number;

  increment() {
    this.value += 1;
  }
}

const game = new GameDefinitionBuilder<{ value: number }>("counter")
  .rootState(CounterState)
  .initialState(() => ({ value: 0 }))
  .commands([
    {
      commandId: "increment",
      validate: () => ({ ok: true }),
      execute: ({ game }) => {
        (game as CounterState).increment();
      },
    },
  ])
  .build();
```

The executor still returns plain canonical state. The decorated facade is a
temporary execution-time authoring layer over a cloned working copy.
