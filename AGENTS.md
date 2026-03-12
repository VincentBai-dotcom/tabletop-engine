# tabletop-kernel

## Goal

`tabletop-kernel` is intended to be a reusable, transport-agnostic runtime for board-game rules engines. The purpose is to let a coding agent build game-specific rules on top of a stable kernel instead of re-implementing the same runtime infrastructure for every game.

The kernel should eventually provide first-class support for:

- turn and phase progression
- event emission and handling
- triggered abilities
- stack or queue resolution when a game needs it
- hidden information and player-specific views
- deterministic randomness
- serialization and persistence boundaries
- replay logs and deterministic replay
- simulation support
- a runtime-native test harness

## Non-Goals

This repository should not make transport or hosting decisions for its users.

Out of scope for the kernel:

- web-specific concerns
- server/client coupling
- lobby/auth/storage product decisions
- assumptions about browser, Steam, native app, peer-to-peer, or dedicated server deployment

Consumers of `tabletop-kernel` should be able to host and present the runtime however they want.

## Current Status

The repo is in the research/bootstrap stage.

Current state as of 2026-03-12:

- no runtime implementation yet
- initial `boardgame.io` runtime research has been added
- project direction is now explicitly transport-agnostic

The current reference document is:

- `docs/research/2026-03-12-boardgame-io-runtime-deep-dive.md`

## What We Learned from boardgame.io

`boardgame.io` is useful as a reference for:

- deterministic reducer-driven state updates
- turn/phase/stage orchestration
- seed-backed randomness with persisted PRNG state
- player-view filtering and log redaction
- practical undo/redo and action logging

It is not a complete blueprint for this repo because it does not provide a first-class:

- domain event bus
- triggered-ability engine
- stack/priority resolution model
- rich hidden-information model
- semantic replay model for complex tabletop engines

## Immediate Priorities

The next implementation work should define the kernel architecture around a few explicit subsystems:

1. Core runtime state model
2. Progression engine for turns/phases/steps
3. Command and event pipeline
4. Trigger engine
5. Resolution stack/queue abstraction
6. Visibility/hidden-information model
7. Deterministic RNG service
8. Serialization and snapshot format
9. Replay/history model
10. Kernel-native test harness

## Working Principle

Prefer engine semantics over framework convenience.

That means:

- model domain events explicitly
- keep deterministic behavior inspectable
- separate authoritative state from observer views
- treat replay and testing as core runtime capabilities
- avoid baking in transport assumptions
