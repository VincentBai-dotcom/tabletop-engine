# Visibility Model Decisions

This is a living design document for the visibility and hidden-information topic.

Update this file whenever a visibility-model design decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

### Hidden-information model

Hidden information should be modeled primarily as viewer-specific filtered projections of one canonical state.

Current high-level direction:

- the game has one authoritative canonical state
- viewer-specific or actor-specific views are derived projections of that state
- the kernel should provide the mechanism for visibility filtering, while the consumer defines the actual visibility policy for a game

Implication:

- hidden information does not require separate per-player state stores as the primary model
- replay, determinism, and save/load stay aligned with the earlier single-canonical-state decision
- different viewers may legitimately receive different filtered projections of the same underlying state

Rationale:

- keeps one source of truth
- avoids consistency problems across multiple parallel player-specific stores
- matches the earlier command-discovery decision that discovery may vary by viewer without changing canonical truth

### Visibility-policy shape

The consumer should define visibility primarily through smaller per-object or per-node visibility rules rather than one giant whole-state projection function.

Current high-level direction:

- the kernel should support composable visibility rules over canonical state
- consumers should be able to express visibility at a smaller-grained level such as objects, entities, zones, or other meaningful substructures
- canonical state should still remain plain data, even if consumers use helper classes or facades around that data during rule authoring

Implication:

- visibility logic can stay modular and local instead of forcing one monolithic projection function
- this remains compatible with the earlier single-canonical-state decision
- consumer ergonomics can still use helper abstractions without turning the persisted state itself into class instances

Rationale:

- whole-state projection logic would become unwieldy for larger games
- smaller-grained rules are easier to evolve and reason about
- this preserves consistency with the earlier decision that canonical state remains plain serializable data

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

5. visibility / hidden-information model
