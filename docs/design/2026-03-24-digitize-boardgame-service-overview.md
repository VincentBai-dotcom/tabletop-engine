# Digitize Your Boardgame In 3 Days

## Goal

Build a service where a boardgame designer can pay to get their game playable
online on my platform in roughly three days.

The service takes:

- the rulebook
- card or component assets
- game-specific clarifications if needed

and delivers:

- a playable web client
- online multiplayer support
- a backend for that game
- a game-specific rule engine implementation

## Core Thesis

Most boardgames differ in theme and detailed rules, but share a common runtime
shape:

- turn-based progression
- one authoritative game state tree
- a finite set of legal options for a player at a time
- deterministic rule execution
- events, triggers, and state transitions
- multiplayer synchronization

Because of that, the business should not build every game from scratch.
It should build a reusable platform and only customize the game-specific rule
layer for each new title.

`tabletop-kernel` exists to capture that reusable runtime layer.

## Product Shape

The service is not just a coding service. It is a standardized digitization
pipeline.

Customer promise:

- give me your rulebook and assets
- I implement your game on the platform
- your game is playable online with the same high-level product experience as
  other games on the platform

This implies a product strategy with two layers:

1. shared platform
2. per-game implementation

The business value comes from making the second layer much cheaper and faster by
investing heavily in the first.

## Shared Architecture

Every game on the platform should follow the same high-level architecture:

1. web client
2. game-specific backend
3. game-specific rule engine

### Web Client

The web client is the player-facing surface.

Responsibilities:

- render the current game state
- present legal actions and follow-up inputs
- submit player commands
- receive authoritative updates from the host
- support online multiplayer and reconnection

### Game-Specific Backend

Each game has a backend surface that serves that game specifically.

Responsibilities:

- host the authoritative match
- expose the game's command execution API
- maintain multiplayer session state
- coordinate persistence, reconnection, and player updates
- translate between platform transport and the rule engine

This layer may be standardized in framework shape even if each game has its own
API surface and deployment unit.

### Game-Specific Rule Engine

This layer contains the actual game rules.

Responsibilities:

- maintain the canonical state tree
- validate and execute commands
- expose currently available options
- handle turn and phase progression
- emit semantic events
- support deterministic replay and testing

This is where the game differs most, but it should be built on a shared kernel
instead of a one-off runtime.

## Role Of `tabletop-kernel`

`tabletop-kernel` is the reusable runtime foundation for all games on the
platform.

It should provide:

- canonical state handling
- progression lifecycle
- command validation and execution
- command discovery
- deterministic RNG
- replay and snapshots
- testing support

It should not contain:

- web UI logic
- product-specific backend concerns
- account, lobby, billing, or marketplace logic
- game-specific rules

Its purpose is to let an agent or developer focus on implementing the game's
actual rules instead of rebuilding runtime infrastructure each time.

## Operating Model

The intended delivery workflow is:

1. collect the rulebook and assets
2. extract the game's components, state model, commands, progression, and edge
   cases
3. implement the game-specific rules on top of `tabletop-kernel`
4. connect those rules to the standard backend shape
5. connect the backend to the standard web client architecture
6. verify multiplayer playability
7. ship the game on the platform

The long-term goal is that most of the implementation work becomes agentic and
template-driven, with human intervention mainly for ambiguous rules, polish, and
quality control.

## Why This Can Work

This service is only viable if the shared platform absorbs a large fraction of
the engineering cost.

That means:

- the client architecture must be reusable
- the backend hosting model must be reusable
- the rule-engine runtime must be reusable
- the implementation workflow must be repeatable

Without that, "digitize in 3 days" collapses into bespoke software consulting.

With that, the per-game work becomes primarily:

- modeling the game's state
- implementing commands and progression
- mapping assets into the platform UI

## Strategic Constraint

The platform should optimize for a narrow class of games first:

- turn-based board and card games
- authoritative multiplayer
- one canonical state tree
- discrete commands and legal option sets

Trying to support every possible game shape too early would weaken the service.

The right strategy is to specialize first, then broaden only after repeated
patterns appear.

## Open Questions

- How standardized should the web client be across different games?
- Should each game get a dedicated backend service, or a shared hosted runtime
  with per-game plugins?
- How much of the backend API shape should be generated from the rule engine?
- How much UI can be standardized versus game-specific?
- What kinds of games fit the three-day promise, and which do not?
- What operational tooling is required for rapid onboarding, testing, and
  deployment?

## Current Direction

For now, the technical foundation should continue focusing on:

- strengthening `tabletop-kernel`
- proving the end-to-end flow with concrete games
- clarifying the boundary between kernel, game rules, backend host, and client

The business idea depends on the platform becoming real, repeatable, and fast to
extend.
