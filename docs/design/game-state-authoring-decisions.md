# Game State Authoring Decisions

This is a living design document for how consumers define and mutate game state.

Update this file whenever a game-state-authoring decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

Existing relevant constraints already established elsewhere:

- canonical game state remains plain serializable data
- consumers may use helper classes, facades, or operation wrappers around canonical state during rule execution
- consumer rules may directly mutate `game` during kernel-controlled execution
- consumers may not directly mutate `runtime`

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

- how consumers should define game state in a maintainable way
- how human-friendly game modeling relates to the engine's plain object-tree view
- what mutation ergonomics the kernel should expose to consumers
