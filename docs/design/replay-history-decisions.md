# Replay And History Decisions

This is a living design document for the replay and history topic.

Update this file whenever a replay/history design decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

### Replay basis

Replay should use a hybrid approach based on commands plus checkpoints or snapshots.

Current high-level direction:

- commands or external inputs remain part of the replay story
- checkpoints or snapshots should also be available so replay does not have to start from the absolute beginning every time
- replay should not depend solely on a pure command log or solely on committed events

Implication:

- replay can stay deterministic while still being practical for longer-running games and tooling
- snapshots and command history complement each other rather than competing as exclusive sources

Rationale:

- full command-only replay can become slow or unwieldy for long histories
- checkpointed replay is more practical for debugging, tooling, and resuming from intermediate points
- this hybrid direction fits the earlier decisions around full snapshots and deterministic execution

### Replay role

Replay and history should be treated both as a core runtime capability and as useful tooling or debugging support, while the exact interface can still stabilize later.

Current high-level direction:

- replay is not just a developer convenience; it is part of the runtime value exposed to real games and players
- tooling and debugging also benefit from the same replay/history foundation
- the interface can still evolve before it is treated as a fixed public contract

Implication:

- replay should be designed as a real runtime capability from the beginning
- later interface stabilization can happen once practical usage patterns become clearer

Rationale:

- players and hosts may want to inspect or replay past games as a product feature, not just a development tool
- building replay in from the start is easier than retrofitting it later
- this still leaves room to refine the public API once the first implementation exists

### Replay payload scope

Replay and history should center on public execution artifacts first, with debug-oriented metadata only included as optional information when available.

Current high-level direction:

- the core replay/history story should rely on artifacts such as commands, snapshots, and committed events
- debug metadata may be attached when useful, but it should not become the defining basis of replay

Implication:

- replay remains suitable for both runtime use and player-facing features
- debugging benefits can still exist without making debug-only fields mandatory for the core replay model

Rationale:

- the kernel should not make replay depend on development-only metadata
- public runtime artifacts are the most stable foundation for long-term replay support
- optional debug detail still helps investigations when available

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

8. replay/history model
