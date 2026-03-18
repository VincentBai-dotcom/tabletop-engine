# RNG Model Decisions

This is a living design document for the deterministic RNG topic.

Update this file whenever an RNG-model design decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

### RNG ownership

Randomness should be treated as a kernel-owned deterministic service rather than left entirely to consumer-managed ambient randomness.

Current high-level direction:

- the kernel should provide the main RNG mechanism used by deterministic game logic
- consumer game rules should use kernel RNG rather than arbitrary ambient random libraries when they want replay-safe behavior
- RNG state should be part of the engine's deterministic and serializable runtime story

Implication:

- deterministic replay, simulations, and tests can rely on persisted RNG state rather than hidden library internals
- randomness remains available to consumers, but through a kernel-controlled service rather than unconstrained ambient APIs

Rationale:

- randomness affects replay, serialization, auditability, and cross-host consistency
- kernel-owned RNG fits the repo goal of deterministic simulation and reusable runtime infrastructure
- leaving randomness fully outside the kernel would weaken key guarantees this runtime is supposed to provide

### Enforcement posture

Kernel RNG should be the only supported randomness path for deterministic game logic, but enforcement machinery is deferred until real consumer behavior shows it is needed.

Current high-level direction:

- deterministic game logic is expected to use kernel RNG rather than ambient randomness
- eventual enforcement can come from API design plus linting, tests, or tooling rather than pretending TypeScript can prevent all ambient randomness by itself
- the kernel should not prioritize building that enforcement machinery until implementation experience shows consumers or agents actually need the constraint reinforced

Implication:

- the design direction is clear without overbuilding enforcement prematurely
- future enforcement remains available if agent-authored or consumer-authored rules start violating the deterministic RNG boundary

Rationale:

- a "hard requirement" is meaningless if the system cannot realistically support or check it
- practical enforcement in TypeScript is possible only through structure and tooling, not absolute runtime prohibition
- deferring the enforcement layer matches the broader preference to avoid premature complexity until real failure modes appear

### RNG surface area

The first version should expose only basic deterministic RNG primitives.

Current high-level direction:

- kernel RNG should focus on basic building blocks such as random numbers, dice-like rolls, shuffles, and similar core primitives
- higher-level consumer-defined random operations should be built on top of those primitives rather than standardized by the kernel in v1

Implication:

- the first RNG service stays small and easier to reason about
- consumer-specific random mechanics can still be expressed without turning the kernel RNG surface into a large domain library

Rationale:

- basic deterministic primitives cover many games while keeping the kernel generic
- higher-level random operations are easier to add later than to remove if the initial surface becomes too opinionated

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

6. deterministic RNG service
