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

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

3. trigger engine
