# Trigger Engine Decisions

This is a living design document for the trigger engine topic.

Update this file whenever a trigger-engine design decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

### Trigger reaction model

Triggers should react to explicit engine facts rather than raw state transitions.

Current high-level direction:

- the trigger engine should support both pre-commit prospective events and post-commit committed events
- pre-commit events represent something that is about to happen and may be prevented, replaced, modified, or cancelled
- committed events represent what actually happened after execution settles

Implication:

- trigger rules such as "when this would happen" and "after this happens" can coexist without relying on raw state-diff inspection
- if a pre-commit event is prevented or replaced, the later committed event may be changed or may never occur
- the trigger engine should not be modeled as reacting directly to opaque state transitions

Rationale:

- tabletop rules often care both about what is about to happen and what did happen
- effects like prevention, replacement, or cancellation need a pre-commit layer
- effects like "after damage is dealt" need a committed post-fact layer

### Trigger ownership

Public trigger rules should be consumer-defined rather than built into the kernel as a game-facing trigger catalog.

Current high-level direction:

- consumer-defined rules own actual game triggers
- the kernel may still use private trigger-like control-flow mechanics internally when needed
- those kernel-private mechanics should not be exposed as the same public trigger abstraction used by game rules

Implication:

- the reusable trigger system exposed to game authors is consumer-defined
- runtime continuation and bookkeeping remain kernel concerns rather than public built-in triggers

Rationale:

- keeps the public trigger model focused on game semantics rather than engine internals
- avoids blurring game rules with private runtime control flow
- matches the broader design choice that public abstractions should belong to the consumer while kernel-private mechanics stay internal

### Trigger firing model

Matching triggers should be queued and resolved in a controlled order rather than firing immediately inline the moment a matching event appears.

Current high-level direction:

- matching triggers should enter a queue or similar controlled pending structure
- resolution order matters, but the exact ordering policy can be deferred until later
- trigger resolution should remain part of the engine's deterministic sequencing model

Implication:

- the engine can preserve a clear execution order for cascading trigger chains
- trigger processing can be reasoned about as explicit pending work rather than hidden inline side effects
- exact ordering rules can be designed later without abandoning the queued model

Rationale:

- queued resolution is easier to reason about than ad hoc immediate trigger firing
- it fits tabletop patterns where triggered effects often wait to resolve in a defined order
- it gives the engine a cleaner foundation for later work on stacks, queues, and deterministic replay

### Optional-trigger scope

The first version should support mandatory automatic triggers only.

Current high-level direction:

- optional or "may" triggers should not require a separate special trigger category in v1
- if a trigger requires a player choice about whether to proceed, that can be modeled as a mandatory trigger that creates a pending choice

Implication:

- the first trigger model stays simpler
- player agency inside triggered effects can still be expressed through the already chosen pending-choice mechanism

Rationale:

- avoids adding a second trigger flavor before the base trigger engine exists
- reuses the pending-choice abstraction instead of inventing a parallel optional-trigger mechanism
- keeps the first trigger engine focused on one clear default behavior

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

3. trigger engine
