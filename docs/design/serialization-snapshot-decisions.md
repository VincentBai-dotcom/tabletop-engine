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

### Snapshot-contract posture

The snapshot format should be treated as internal first and stabilized later when real hosts or tools begin to depend on it.

Current high-level direction:

- the first implementation should avoid freezing a public snapshot contract too early
- once real external hosts, replay tools, tests, or interop consumers begin depending on snapshot structure, the format can be stabilized more deliberately

Implication:

- the kernel keeps room to evolve the first snapshot shape
- stabilization remains a later conscious step rather than an accidental early contract

Rationale:

- snapshot shape often becomes a contract in practice once external systems depend on it
- deferring formal stabilization avoids freezing an immature format too early

### Persistence boundary

Persistence is consumer-owned for now, while the option to standardize a kernel-level abstraction remains open if real usage patterns justify it later.

Current high-level direction:

- the kernel should produce and consume deterministic serializable artifacts such as snapshots and replay data
- consumers or hosts should decide where and how those artifacts are persisted
- the kernel should not yet provide official storage adapters or a broad persistence abstraction layer

Implication:

- transport and host decisions remain outside the kernel
- persistence can still be revisited later if repeated integration patterns show that a shared abstraction would meaningfully reduce duplication

Rationale:

- persistence is closely tied to hosting and infrastructure choices
- this repo is intentionally transport-agnostic
- it is better to wait for real usage patterns than invent a persistence abstraction prematurely

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

7. serialization / snapshot format
