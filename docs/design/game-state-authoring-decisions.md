# Game State Authoring Decisions

This is a living design document for how consumers define and mutate game state.

Update this file whenever a game-state-authoring decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

Existing relevant constraints already established elsewhere:

- canonical game state remains plain serializable data
- consumers may use helper classes, facades, or operation wrappers around canonical state during rule execution
- consumer rules may directly mutate `game` during kernel-controlled execution
- consumers may not directly mutate `runtime`

### State authoring shape

Consumers should author game state as composable plain-data submodules that are assembled into one canonical game-state tree, rather than as one monolithic top-level state definition.

Current high-level direction:

- consumers may define smaller state modules such as deck, player, board, pieces, or other domain-specific substructures
- the final canonical `GameState` is assembled from those submodules
- canonical state still remains one plain serializable tree even when authored modularly

Rationale:

- a monolithic giant `GameState` definition would be hard to maintain
- modular plain-data composition is more human-friendly while staying compatible with deterministic serialization

### Helper and facade usage

Helper classes, facades, or operation wrappers are optional ergonomics, not required structure.

Current high-level direction:

- consumers may mutate plain canonical state directly during rule execution
- helper abstractions such as `DeckOps` are useful only when they materially improve readability, reuse, or domain clarity
- the kernel should not pressure consumers into wrapping every state subtree in classes or facades

Rationale:

- direct state mutation is often the clearest expression of a rule
- helper abstractions are valuable when they remove repetition or encode domain invariants
- forcing helpers everywhere would create unnecessary boilerplate

### Module-local rule authoring

Consumers may define related helpers, commands, or internal steps near the state modules they mostly operate on, while still assembling them into one final game definition.

Current high-level direction:

- state modules can own nearby rule-authoring code for ergonomics
- steps or commands do not need to be confined to one module if they naturally touch multiple subtrees
- the final game definition is the assembly point, not the place every implementation detail must live

Rationale:

- keeps game code modular without forcing artificial separation between data and closely related rule logic
- avoids turning one central file into the only place where rules can be expressed

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

- how consumers should define game state in a maintainable way
- how human-friendly game modeling relates to the engine's plain object-tree view
- what mutation ergonomics the kernel should expose to consumers
