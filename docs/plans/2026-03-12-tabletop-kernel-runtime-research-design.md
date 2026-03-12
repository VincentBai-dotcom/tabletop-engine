# Tabletop-Kernel Runtime Research Design

**Date:** 2026-03-12

**Goal**

Produce a capability-first deep dive on the `boardgame.io` runtime that explains how the relevant pure-logic pieces work, analyzes what `tabletop-kernel` should keep or avoid, and identifies capabilities needed beyond `boardgame.io`. Add a root `AGENTS.md` that states the repo goal and current status.

**Scope**

- Inspect `boardgame.io` runtime code with code-level references.
- Focus on pure functionality and business logic.
- Ignore client, lobby, server, and transport concerns except where they influence hidden-information or replay behavior.
- Create documentation only; do not implement the runtime yet.

**Deliverables**

- `docs/research/2026-03-12-boardgame-io-runtime-deep-dive.md`
- `AGENTS.md`

**Document Structure**

The research document will be organized by runtime capability rather than by `boardgame.io` package layout. Each major section will include:

1. What the capability does in `boardgame.io`
2. Key files and functions
3. Runtime flow and state model
4. What `tabletop-kernel` should keep
5. What `tabletop-kernel` should avoid
6. What `tabletop-kernel` likely needs beyond `boardgame.io`

**Planned Sections**

- Runtime architecture and reducer / plugin pipeline
- Turn, phase, stage, and active-player progression
- Move execution, validation, and action lifecycle
- Events and triggered state transitions
- Randomness and deterministic simulation
- Hidden information and player-specific views
- Serialization and serializability checks
- Replay logs, deltalogs, patches, and undo / redo
- Testing support and deterministic harnesses
- Gaps relative to `tabletop-kernel` goals, especially triggered abilities, event bus design, stack / queue resolution, and richer hidden information

**Design Decision**

The writeup should describe `boardgame.io` faithfully rather than forcing `tabletop-kernel` to copy it. The analysis should separate:

- reusable runtime patterns worth keeping,
- framework assumptions that are too opinionated for a transport-agnostic engine,
- missing concepts that `tabletop-kernel` must add as first-class primitives.
