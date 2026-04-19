# Online Splendor Backend Service Design

## Purpose

This document defines the internal backend service design for the first hosted
online Splendor build.

The goal is simplicity.

That means:

- one deployable backend service
- one Postgres database
- one WebSocket connection per connected client
- no microservice split
- no public-auth system
- explicit internal module boundaries without overengineering

This document builds on the existing hosted requirements and stack decisions:

- [2026-04-17-online-splendor-hosted-requirements-design.md](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-17-online-splendor-hosted-requirements-design.md)
- [2026-04-18-online-splendor-backend-stack-design.md](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-18-online-splendor-backend-stack-design.md)

## Summary

The backend should be a single `Elysia` service deployed on Render with Render
Postgres and `drizzle` as the database ORM.

Internally, the backend should be split into a few code modules:

- transport
- anonymous session identity
- room lifecycle
- active game session lifecycle
- persistence

These are code boundaries, not deployable-service boundaries.

## Core Design Principles

### 1. One Deployable Service

The backend should remain one application process.

Do not split:

- room service
- game service
- websocket service

into separately deployed systems for the first build.

Reasons:

- lower operational complexity
- simpler local development
- fewer distributed failure modes
- easier debugging
- enough for validating `tabletop-engine` in a real hosted product

### 2. Separate Internal Modules

Even though the backend is one deployable, room and active game logic should
not live in one shared blob of handlers.

Use separate internal modules for:

- `room`
- `game-session`
- `transport/http`
- `transport/websocket`
- `session`
- `db`

This keeps lifecycle rules understandable without introducing a service split.

### 3. Database Is Authoritative

Postgres should be the source of truth for hosted state while a room or game is
alive.

Do not treat the database as an audit sink while keeping authoritative session
state only in memory.

The database is needed to support:

- reconnect/resume on the same browser
- process restart safety
- consistent room/game lifecycle transitions

### 4. Prefer Simpler Product Semantics

The product and service should explicitly favor simple rules over maximum
flexibility.

Examples:

- automatic seat assignment in join order
- short randomly generated room codes
- host transfer only before game start
- no spectators
- no cross-device reclaim
- game invalidation when an in-game player truly disconnects

## Runtime Shape

The service should have four major runtime phases:

1. create/join bootstrap
2. pre-game room
3. active game session
4. terminal end state

Room and game should be treated as distinct phases even if they share some
infrastructure underneath.

## Internal Module Boundaries

### 1. `transport/http`

Responsibilities:

- create room endpoint
- join room endpoint
- leave room before socket connection if needed
- any initial bootstrap/read endpoints

This layer should:

- validate request shapes
- resolve anonymous session identity
- call domain modules
- return plain serializable responses

This layer should not hold room/game business logic directly.

### 2. `transport/websocket`

Responsibilities:

- connection authentication using the anonymous session token
- connection registry
- room/game subscription switching
- pushing room updates
- pushing game updates
- receiving live session actions

This layer should own raw socket mechanics.

It should not own room/game rules.

### 3. `session`

Responsibilities:

- anonymous browser identity issuance
- token validation
- reconnect identity lookup

The identity model is:

- no login/signup
- backend-issued anonymous token
- same browser/device resumes with stored token
- different device cannot reclaim the same seat

### 4. `room`

Responsibilities:

- create room
- generate room code
- assign seats in join order
- enforce unique display names within room
- ready/unready
- host transfer before start
- start eligibility validation
- room deletion when last player leaves before start

This module should not own raw WebSocket instances.

Instead, it should return or emit plain domain outcomes that the transport
layer can fan out.

### 5. `game-session`

Responsibilities:

- create active game session from room state
- initialize canonical game state
- execute commands through `tabletop-engine`
- persist updated canonical snapshot
- publish resulting visible state/events
- reconnect resume for seated players
- invalidate game on unrecoverable in-game disconnect
- finalize end-of-game state

### 6. `db`

Responsibilities:

- Drizzle schema definitions
- query helpers / repositories
- transaction boundaries where needed

This layer should stay focused on persistence, not room/game policy.

## Transport Design

### HTTP Scope

Use HTTP for bootstrap actions:

- create room
- join room by code
- any initial fetch needed before entering the live room/game loop

Why:

- these are short-lived request/response actions
- easier to reason about without a live socket
- cleaner initial browser boot flow

### WebSocket Scope

Use WebSocket for live session actions and updates:

- room updates
- ready / unready
- host start-game action
- active game command submission
- command results / state updates
- invalidation notifications
- terminal result delivery

### One Socket Per Client

Use one physical WebSocket connection per connected client.

Do not require a room socket and then a separate game socket.

The server should switch the client’s active subscription target by phase:

- room subscription before start
- game-session subscription after start

Reasons:

- simpler reconnect behavior
- simpler identity continuity
- cleaner room-to-game handoff

## Command Submission

Accepted game commands should be submitted over WebSocket, not HTTP.

Reasons:

- the socket is already established for live session updates
- easier to correlate command submission with pushed results
- fewer transport modes during active play
- cleaner active-session semantics

HTTP remains the better fit for room bootstrap actions, but active game actions
should stay on the socket.

## Persistence Strategy

### Persist On Every Accepted Command

The backend should persist the canonical game snapshot after every accepted
command execution.

Do not keep accepted-command state only in memory and checkpoint later.

Reasons:

- simpler correctness model
- restart safety
- same-browser reconnect can reload authoritative state immediately
- easier debugging and operational reasoning

This also fits Splendor’s turn-based write volume.

The system does not need event-sourcing for the first build.

## Anonymous Session Model

### Token Creation

Do not add a dedicated “initialize anonymous session” endpoint.

Instead:

- if the client already has a stored anonymous token, use it
- if not, the first create-room or join-room request implicitly creates one

The server returns the token, and the browser stores it locally.

Why:

- fewer API steps
- simpler client boot flow
- aligns with the no-account model

## Room Design

### Room Codes

Room codes should be:

- short
- uppercase
- randomly generated by the backend

Users do not manually choose room codes.

Room code uniqueness should be enforced globally across active rooms, with
generation retried until a free code is found.

### Seat Assignment

Seat assignment should be automatic in join order.

Do not support host-controlled seat reordering in the first build.

Why:

- simpler room state
- fewer UI actions
- fewer transition rules

### Host Model

The room has exactly one host before the game starts.

If the host leaves before start:

- transfer host to the next seated player

After the game starts, there is no separate “host powers” model needed for the
active session.

## Game Session Design

### Start Transition

When the room starts:

- room stops being joinable
- no new players can enter
- the room creates one active game session
- initial canonical state is created from the seated players

The active game session should carry:

- seated player identity mapping
- canonical snapshot
- session status
- final result once ended

### Disconnect Rule

Before game start:

- a leaving/disconnected player simply frees their seat

After game start:

- if a seated player truly disconnects and cannot resume from the same browser,
  invalidate the game and end it

This is intentionally strict to keep the no-account model simple.

### End-State Handling

When the game ends:

- push a terminal result payload to connected clients
- backend may then delete the canonical game snapshot
- client renders a lightweight end screen from the final payload

The backend does not need long-term persistence after that point.

## Database Shape

The first build should likely include tables equivalent to:

- anonymous sessions
- rooms
- room seats / room players
- active game sessions
- active game snapshots

Possible optional short-lived end-state storage:

- terminal game results

The exact schema design can be refined during implementation, but the
relational model should mirror the product lifecycle:

- session identity
- room phase
- active game phase

## Drizzle Usage

Use `drizzle` for:

- schema declarations
- migrations
- typed query building

Reasons:

- strongly typed relational modeling
- good fit for Postgres
- keeps database access explicit
- simpler than inventing a local persistence abstraction first

The backend should use Drizzle directly inside the `db` layer rather than
wrapping it in an unnecessary generic repository framework.

## Recommended Service Structure

A simple package structure for the first implementation would look like:

```text
examples/splendor/server/src/
  index.ts
  app.ts
  config/
  db/
    schema.ts
    client.ts
    migrations/
  session/
  room/
  game-session/
  transport/
    http/
    websocket/
  lib/
```

This is intentionally simple:

- one app entrypoint
- one DB layer
- two main domain modules
- transport split by protocol

## Non-Goals

Not part of this first backend design:

- separate deployable services
- Redis
- event sourcing
- durable replay/history product features
- public matchmaking
- spectator flows
- admin control plane

## Recommendation

Build the backend as a single `Elysia` service with:

- `drizzle` over Render Postgres
- HTTP for room bootstrap
- one WebSocket connection for live room/game traffic
- separate internal `room` and `game-session` modules
- persistence on every accepted command

This is the simplest design that still gives:

- reconnect safety
- clean lifecycle boundaries
- real end-to-end hosted game behavior
- a credible validation of `tabletop-engine` in a production-shaped service
