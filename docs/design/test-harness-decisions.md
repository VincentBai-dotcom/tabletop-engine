# Test Harness Decisions

This is a living design document for the kernel-native test harness topic.

Update this file whenever a test-harness design decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

### Harness audience

The kernel-native test harness should serve both kernel self-tests and consumer-authored game tests.

Current high-level direction:

- the harness should help verify kernel-level guarantees such as determinism, atomicity, sequencing, replay consistency, and snapshot behavior
- the same harness should also help consumers test game-specific rules, progression, triggers, and seeded scenarios

Implication:

- the runtime and its consumers can share one deterministic testing surface
- kernel self-tests remain focused on runtime guarantees rather than game-specific content

Rationale:

- a shared harness reduces duplication between kernel verification and game-rule verification
- kernel guarantees are most trustworthy when tested through the same runtime surface consumers actually use
- consumers benefit from a ready-made deterministic test environment rather than rebuilding one for each game

### Harness style

The harness should support both scenario-style tests and lower-level runtime assertions, with scenario-style testing as the main consumer-facing mode.

Current high-level direction:

- consumers should mainly interact with the harness through scenario-like tests built from seeds, commands, and assertions
- the kernel should also be able to use the same harness for lower-level runtime checks and invariants

Implication:

- consumers get an ergonomic deterministic testing style close to how games are actually exercised
- kernel maintainers still have room for deeper runtime-focused assertions when needed

Rationale:

- scenario-style tests are the most natural fit for game-rule authors
- lower-level assertions are still valuable for kernel guarantees that are awkward to express only as high-level scenarios

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

9. kernel-native test harness
