# Serialization And Snapshot Decisions

This is a living design document for the serialization and snapshot topic.

Update this file whenever a serialization or snapshot design decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

### Snapshot shape

Snapshots should use full canonical state by default, with delta or patch-based forms deferred until later if they become necessary.

Current high-level direction:

- the baseline snapshot unit is the full canonical state
- delta or patch snapshots are not the default representation in the first version
- more compact snapshot forms can be added later if implementation experience shows a real need

Implication:

- the first snapshot model stays aligned with the earlier whole-state canonical snapshot decision
- save/load and replay infrastructure can start from one straightforward snapshot shape

Rationale:

- full snapshots are simpler to reason about
- deltas add complexity and are easier to layer on later than to remove if they are made foundational too early
- this matches the earlier runtime-state preference for whole-state canonical snapshots

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

7. serialization / snapshot format
