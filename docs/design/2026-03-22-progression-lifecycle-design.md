# Progression Lifecycle Design

This document records the current direction for strengthening progression and
lifecycle handling in the kernel.

The motivation is feedback from the current v1 implementation, where turn
progression logic is too easy for consumers to forget because commands must
manually call helper logic like `finishTurn()`.

## Current Direction

The current direction is:

- progression advancement should be a kernel-managed lifecycle concern
- commands should not need to manually end turns or advance progression in the
  common case
- progression remains a nested abstraction
- a single successful command may trigger multiple progression transitions
- automatic progression should be supported and should be on by default
- automatic progression should still be optional, because some games want the
  player to explicitly end the turn even when no further actions remain
- progression completion policy may vary by player or role in asymmetric games

## Problem This Solves

The current pattern is too manual.

For example, in the Splendor example:

- each action command calls `finishTurn()`
- `finishTurn()` also advances the current segment owner
- forgetting to call it becomes a correctness bug

That means turn progression is currently sitting at the wrong layer.

The kernel should own progression lifecycle handling so consumers do not have to
repeat the same turn/segment advancement logic in every command.

## New Mental Model

Commands should be responsible for:

- mutating `game`
- emitting domain events

The progression subsystem should be responsible for:

- deciding whether the current segment is complete
- running exit logic for completed segments
- advancing progression
- running entry logic for newly entered segments
- repeating this until the lifecycle reaches a stable point

So the flow should become:

1. command succeeds
2. kernel evaluates progression lifecycle consequences
3. kernel runs segment exit/advance/entry logic as needed
4. kernel stops when no further progression work is required

## Nested Progression Requirement

Progression is explicitly nested.

That means one command may complete more than one segment in one execution.

Examples:

- a command may complete a `step`, which also completes a `phase`, which then
  advances into the next `turn`
- a command may end the current player's turn and also begin a new round

So lifecycle resolution must support chained progression changes rather than
assuming only one transition per command.

The progression lifecycle should therefore be treated as:

- iterative
- nested
- possibly cascading across multiple segment boundaries

## Automatic Progression

Automatic progression should exist and should be enabled by default.

Reason:

- many tabletop games have progression rules that follow directly from a
  successful action
- consumers should not need to repeat turn-ending logic in every command

However, automatic progression should not be mandatory.

Some games, especially digital card games, may want:

- a player to click `End Turn`
- even when they have no more interesting actions

So progression should support both:

- automatic lifecycle advancement
- explicit/manual completion commands

The current direction is:

- auto progression on by default
- consumer can opt out or customize the completion rule

## Completion Policy

The progression subsystem should support a configurable completion policy for a
segment.

The important point is that the policy should not be globally fixed.

Examples of different policies:

- complete after any successful action
- complete only after an explicit `EndTurn` command
- complete when no legal commands remain
- complete when a custom consumer-defined condition becomes true

This completion policy should be part of progression configuration rather than
repeated inside command bodies.

## Asymmetric Game Requirement

The completion policy may vary by player, faction, role, or game state.

That means the progression subsystem must not assume:

- every player has the same command set
- every player completes a turn the same way
- every segment lifecycle rule is uniform across actors

For asymmetric games such as Root-like designs, progression policy may depend
on:

- active player identity
- faction or role
- current segment
- current game state

So completion policy should be allowed to be:

- state-dependent
- actor-dependent
- consumer-defined

## Consumer Experience Direction

The intended consumer experience is:

- define commands around the game action itself
- define progression lifecycle rules in the progression subsystem
- let the kernel invoke progression lifecycle automatically after command
  success

That means a consumer should be able to avoid patterns like:

- every command manually calling `finishTurn()`
- every command manually calling `setCurrentSegmentOwner()`

Those behaviors should instead come from progression/lifecycle configuration.

## Likely Kernel Hooks

Exact API is still open, but the kernel likely needs concepts like:

- segment completion policy
- segment exit hook
- segment entry hook
- next-owner resolution
- next-segment resolution
- iterative lifecycle resolution until stable

The exact names are still undecided.

The key principle is:

- progression logic should be centralized and declarative enough that the kernel
  can apply it automatically after command execution

## Splendor-Like Interpretation

For a game like Splendor, the likely progression policy is:

- current segment: `turn`
- completion policy: after any successful action
- exit behavior: resolve end-of-turn consequences such as noble checks
- next owner: next player in turn order

Under that model:

- `take gems`
- `reserve card`
- `buy card`

would no longer need to manually end the turn.

## Hearthstone-Like Interpretation

For a game like Hearthstone, the likely progression policy is different:

- current segment: `turn`
- completion policy: explicit manual end-turn command
- command success alone does not auto-complete the turn

That is why auto progression must remain optional rather than mandatory.

## Open Questions

The following questions remain open for later:

- what the exact progression lifecycle API should look like
- whether completion policy should be modeled as named strategies, callbacks, or
  both
- how segment entry/exit hooks should interact with events and triggers
- how lifecycle resolution should report multiple chained progression changes in
  execution results and history
- whether progression lifecycle should be entirely in the core package or partly
  in companion abstractions
