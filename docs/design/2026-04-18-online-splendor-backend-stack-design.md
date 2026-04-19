# Online Splendor Backend Stack Design

## Summary

The recommended backend stack for the first hosted online Splendor build is:

- `Elysia`
- `Render`
- `Render Postgres`
- TypeScript throughout

This backend should be implemented as a normal long-running application service,
not as a serverless function system.

## Why This Stack

The hosted Splendor requirements need a backend that can reliably support:

- room creation and join-by-code
- ready/start coordination
- host transfer before game start
- live in-room updates
- active game session updates
- same-browser reconnect
- invalidation when an in-game player truly disconnects

That is a better fit for a persistent application process than for a
serverless/edge-function model.

## Chosen Components

### 1. Application Server: `Elysia`

Use `Elysia` as the backend framework.

Reasons:

- TypeScript-first
- Bun-native
- already familiar from existing work
- built-in HTTP routing
- built-in WebSocket support
- schema validation support

This keeps the backend implementation model simple:

- one application
- one process model
- one language

No additional framework transition is needed.

### 2. Hosting Platform: `Render`

Use `Render` to deploy the backend service.

Reasons:

- supports normal long-running web services
- supports inbound WebSocket connections
- does not enforce a documented maximum WebSocket duration
- better fit than Railway for long-lived room/game connections

This matters because the hosted game model expects players to remain connected
through room flow and active turns, while still supporting reconnect when needed.

Render still does not guarantee socket permanence:

- deploys
- maintenance
- network issues
- instance shutdowns

can all still interrupt connections.

So reconnect logic is still required.

However, Render is a better operational fit than Railway for this use case
because it does not impose the known 15-minute connection churn Railway
documents for WebSocket-style traffic.

### 3. Database: `Render Postgres`

Use `Render Postgres` as the primary database.

Reasons:

- relational data model fits room/session/game state well
- simple co-location with the backend service on the same platform
- easier operational setup than splitting app hosting and database hosting on
  different providers for the first build
- internal/private connection paths are available when app and database are in
  the same Render environment

This should be the source of truth for:

- rooms
- room membership
- host assignment
- ready state
- anonymous browser session identities
- active game session metadata
- canonical game snapshot
- terminal game result records while the end screen is active

## Why Not Supabase For The Main Backend

Supabase is a good data platform, but it is not the recommended primary backend
stack for this project.

Reasons:

- the real game backend wants to be an authoritative long-running application
- room/game coordination is better expressed as application logic than as a
  collection of hosted platform features
- this project does not currently need Supabase Auth, Storage, or Realtime as a
  primary foundation

Supabase could still be used purely as managed Postgres in another variant of
the stack, but that is not the chosen direction here.

## Why Not Railway For The First Hosted Build

Railway remains a viable option for this project, especially if reuse of
existing deployment setup is the top priority.

However, the chosen stack prefers Render because Railway documents a maximum
request duration of 15 minutes and separately calls out a 15-minute connection
limit for deployed Socket.IO/WebSocket-style applications.

For a turn-based board game this is survivable, but it forces periodic
reconnects even during otherwise healthy sessions.

That is unnecessary churn for:

- room presence
- ready state synchronization
- in-game player connectivity

Render is therefore the better platform fit for this hosted game server.

## Backend Responsibilities

The backend service should own:

- anonymous client identity issuance/validation
- room creation
- room-code lookup and join
- seat assignment
- display-name uniqueness within a room
- ready/unready transitions
- host transfer before start
- room start validation
- game session creation
- command submission
- visible-state fanout
- reconnect and resume on the same browser/device
- invalidation when an in-game player truly disconnects
- cleanup of room and game state

## Database Responsibilities

Postgres should be the durable source of truth for hosted state while the room
or game exists.

It should store at least:

- anonymous browser session records
- rooms
- room players / seats
- room code
- room readiness and host information
- active game session metadata
- active canonical game snapshot
- final terminal result payload or metadata, if needed briefly for the end
  screen flow

The database should not be treated as a passive audit store only.

It should be the state authority that allows reconnect and recovery from process
or instance interruption.

## HTTP vs WebSocket Split

Use both HTTP and WebSocket.

### HTTP Endpoints

Use HTTP for short-lived request/response operations such as:

- create room
- join room by code
- ready / unready
- start game
- leave room before start
- initial bootstrap fetch if needed

These actions are naturally request/response oriented.

### WebSocket Endpoints

Use WebSocket for live session traffic such as:

- room presence updates
- seat and ready-state updates
- host transfer updates
- game state updates
- command submission acknowledgements or streaming state changes
- disconnect / invalidation notifications
- end-of-game result delivery

This keeps active room/game interaction low-latency and event-driven.

### Why Not All-WebSocket

An all-WebSocket design is possible, but it is not recommended for the first
build.

Using HTTP for room lifecycle actions keeps:

- request semantics simpler
- retries clearer
- debugging easier
- initial implementation more straightforward

WebSocket should be used where it provides clear value: live session updates.

## Reconnect Model

Even on Render, reconnect must be part of the architecture.

The system should assume:

- sockets are transient
- browser identity token is stable
- database state is authoritative

That means:

- a reconnecting client presents its stored anonymous browser/session token
- the backend reloads room/game state from Postgres
- the backend resubscribes the client to the current room or game stream

The socket connection itself must not be treated as player identity.

## Scaling Assumption

The first hosted build should assume a single backend service instance.

Reasons:

- simplest operational model
- enough to validate the full hosted game flow
- avoids premature distributed coordination complexity

If the project later scales horizontally, likely additional needs will appear:

- shared pub/sub or fanout layer
- more explicit connection routing assumptions
- possibly Redis or another ephemeral coordination mechanism

That is intentionally deferred.

## Logging And Observability

The first version should include enough logging to understand:

- room creation and deletion
- join attempts
- ready/start transitions
- host transfer
- reconnects
- disconnect invalidations
- game-end cleanup

No specialized observability platform decision is required yet, but the backend
should be instrumented clearly enough to debug multiplayer lifecycle issues.

## Relationship To `tabletop-engine`

`tabletop-engine` should stay focused on:

- canonical game state
- visible state projection
- command validation and execution
- deterministic game progression

The hosted backend built on `Elysia + Render + Render Postgres` should add:

- room lifecycle
- transport
- anonymous identity
- reconnect handling
- game session orchestration
- persistence while a room/game is alive

This separation keeps the engine transport-agnostic while still validating that
it can power a full hosted multiplayer game.

## Recommendation

Use:

- `Elysia`
- `Render`
- `Render Postgres`

for the first online Splendor backend.

This is the most pragmatic stack because it:

- fits the hosted room/game lifecycle well
- avoids the operational drawbacks of Railway’s documented connection cap
- keeps everything in TypeScript
- lets the backend remain a normal authoritative application service
