# Online Splendor Backend API And Code Organization Design

## Purpose

This document defines the backend code organization and business-logic API
shape for the hosted online Splendor server.

It builds on:

- [Online Splendor Hosted Requirements](./2026-04-17-online-splendor-hosted-requirements-design.md)
- [Online Splendor Backend Stack](./2026-04-18-online-splendor-backend-stack-design.md)
- [Online Splendor Backend Service](./2026-04-19-online-splendor-backend-service-design.md)
- [Online Splendor Database Schema](./2026-04-19-online-splendor-database-schema-design.md)

The design is informed by:

- Elysia's feature-based module recommendation
- Elysia's guidance to avoid passing full framework `Context` objects into
  service logic
- the existing `boardgame-ref` backend module style

## Goals

The backend should be:

- simple to build incrementally
- testable without a heavy DI framework
- organized by domain feature
- explicit about HTTP vs WebSocket boundaries
- explicit about database transaction boundaries
- close to the product lifecycle: room -> game session -> terminal result

## Non-Goals

Do not introduce:

- microservices
- a DI framework
- generic per-table CRUD repositories
- a centralized repository interface every table must implement
- event sourcing
- a public auth/user module
- cross-device player recovery

## High-Level Structure

Recommended package structure:

```text
examples/splendor/server/src/
  index.ts
  app.ts

  modules/
    config/
      index.ts
      model.ts

    db/
      index.ts
      client.ts

    session/
      index.ts
      model.ts
      service.ts
      store.ts

    room/
      index.ts
      model.ts
      service.ts
      store.ts

    game-session/
      index.ts
      model.ts
      service.ts
      store.ts

    websocket/
      index.ts
      model.ts
      registry.ts
      notifier.ts

  plugins/
    error-handler.ts
    request-id.ts

  schema/
    player-session.ts
    room.ts
    game-session.ts
    index.ts
```

This uses a feature/module layout similar to Elysia's best-practice guidance.
Each feature owns its controller surface, validation models, business service,
and domain-specific store.

## Elysia Boundary

Use Elysia instances as route/controller modules.

Example:

```ts
export const roomModule = new Elysia({ prefix: "/rooms" }).post(
  "/",
  async ({ body, headers, status }) => {
    return roomService.createRoom({
      token: readPlayerSessionToken(headers),
      displayName: body.displayName,
    });
  },
);
```

Do not pass the full Elysia `Context` object into services.

Instead:

- route handlers extract request data
- route handlers call services with plain objects
- services return plain serializable results

This preserves Elysia type inference in controllers while keeping services
decoupled from the framework.

## Light Dependency Injection

Use function/factory-based dependency injection.

Do not use a DI framework.

Example:

```ts
export function createRoomService(deps: {
  db: Db;
  clock: Clock;
  roomCodeGenerator: RoomCodeGenerator;
  notifier: RoomNotifier;
}) {
  return {
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
  };

  async function createRoom(input: CreateRoomInput) {
    // business logic
  }
}
```

Use interfaces or type aliases only for real dependencies:

- `Clock`
- `RoomCodeGenerator`
- `TokenGenerator`
- `TokenHasher`
- `RoomNotifier`
- `GameSessionNotifier`
- `GameRuntime`

Avoid interfaces for every service or table.

## Store Pattern

Do not create one generic CRUD repository class per table.

Instead, create domain-specific store modules around business operations.

Good:

```ts
export async function createRoomWithHost(...)
export async function loadOpenRoomByCode(...)
export async function insertRoomPlayer(...)
export async function markRoomPlayerReady(...)
export async function deleteRoomPlayer(...)
export async function transferRoomHost(...)
```

Avoid:

```ts
roomRepository.create(...)
roomRepository.findById(...)
roomRepository.update(...)
roomRepository.delete(...)
```

The generic CRUD shape hides intent and usually does not encode the real room
or game invariants.

Stores should:

- use Drizzle directly
- stay close to SQL/query concerns
- expose domain-oriented functions
- not own WebSocket fanout
- not own product policy when that policy belongs in services

Services should:

- enforce product rules
- coordinate store calls
- own transaction flow where needed
- return domain outcomes for transport to publish

## Modules

### `modules/config`

Responsibilities:

- load environment configuration
- expose server host/port
- expose database URL
- expose environment mode

This can stay small for v1.

Likely fields:

```ts
{
  env: "development" | "test" | "production";
  server: {
    host: string;
    port: number;
  }
  database: {
    url: string;
  }
}
```

### `modules/db`

Responsibilities:

- initialize Drizzle client
- export DB type
- expose schema to Drizzle if needed

Do not put room/game business methods here.

### `modules/session`

Purpose:

Manage anonymous same-browser player sessions.

This is not a login system.

Business operations:

```ts
resolveOrCreatePlayerSession(input: {
  token: string | null;
}): Promise<{
  playerSessionId: string;
  token: string;
  tokenWasCreated: boolean;
}>
```

Rules:

- if token exists and hashes to a known `player_sessions` row, reuse it
- update `player_sessions.last_seen_at`
- if token is missing or invalid, create a new player session and return a new
  token
- store token hash, not raw token

Suggested dependencies:

- `db`
- `clock`
- `tokenGenerator`
- `tokenHasher`

### `modules/room`

Purpose:

Own pre-game room lifecycle.

HTTP operations:

```ts
createRoom(input: {
  token: string | null;
  displayName: string;
}): Promise<CreateRoomResult>

joinRoom(input: {
  token: string | null;
  roomCode: string;
  displayName: string;
}): Promise<JoinRoomResult>
```

WebSocket live actions:

```ts
leaveRoom(input: {
  playerSessionId: string;
  roomId: string;
}): Promise<RoomActionResult>

setReady(input: {
  playerSessionId: string;
  roomId: string;
  ready: boolean;
}): Promise<RoomActionResult>

startGame(input: {
  playerSessionId: string;
  roomId: string;
}): Promise<StartGameResult>
```

Core rules:

- room code is generated by the backend
- room code is short, uppercase, random, and unique across active rooms
- host is the creator
- host is stored as `rooms.host_player_session_id`
- players are assigned seats in join order
- display names must be unique within the room by normalized
  `display_name_key`
- room capacity is 4
- game can start with 2 to 4 seated players
- every seated player must be ready before start
- only host can start
- if the host leaves before start, transfer host to the next seated player
- if the last player leaves before start, delete the room

Store operations should be domain-specific, for example:

```ts
createRoomWithHost(...)
loadOpenRoomByCode(...)
loadRoomSnapshot(...)
addPlayerToRoom(...)
setPlayerReady(...)
removePlayerFromRoom(...)
transferHostToNextSeat(...)
markRoomStarting(...)
deleteRoom(...)
```

### `modules/game-session`

Purpose:

Own active game lifecycle and `tabletop-engine` execution.

Business operations:

```ts
createGameSessionFromRoom(input: {
  roomId: string;
  requestingPlayerSessionId: string;
}): Promise<GameStartedResult>

submitCommand(input: {
  gameSessionId: string;
  playerSessionId: string;
  command: unknown;
}): Promise<GameCommandResult>

resumeGameSession(input: {
  playerSessionId: string;
  gameSessionId: string;
}): Promise<GameResumeResult>

markDisconnected(input: {
  playerSessionId: string;
  gameSessionId: string;
}): Promise<GameEndedResult | null>
```

Core rules:

- create the `tabletop-engine` executor from `splendor-example`
- map `game_session_players.player_id` to engine `actorId`
- initialize state from room seats and required `rngSeed`
- persist canonical state in `game_sessions.canonical_state`
- increment `state_version` after every accepted command
- persist after every accepted command
- push visible state updates after commit
- delete game state after terminal result has been pushed
- if a seated player truly disconnects after start, invalidate and end the game

Store operations should be domain-specific, for example:

```ts
createGameSession(...)
createGameSessionPlayers(...)
loadGameSessionForCommand(...)
persistAcceptedCommandResult(...)
deleteGameSession(...)
markPlayerDisconnected(...)
clearPlayerDisconnected(...)
```

### `modules/websocket`

Purpose:

Own raw WebSocket mechanics and live fanout.

Responsibilities:

- authenticate socket using player session token
- track active connections by `playerSessionId`
- track subscription target:
  - room subscription before game start
  - game-session subscription after game start
- receive live actions
- call room/game-session services
- fan out domain updates

Do not put room or game business rules here.

Suggested files:

```text
websocket/
  index.ts
  model.ts
  registry.ts
  notifier.ts
```

`registry.ts` manages in-memory active connections.

`notifier.ts` exposes interfaces such as:

```ts
export interface RoomNotifier {
  publishRoomUpdated(roomId: string, payload: RoomSnapshot): void;
  publishGameStarted(roomId: string, payload: GameStartedPayload): void;
}

export interface GameSessionNotifier {
  publishGameUpdated(gameSessionId: string, payload: GameUpdatePayload): void;
  publishGameEnded(gameSessionId: string, payload: GameEndedPayload): void;
}
```

Room and game services can depend on notifier interfaces, not raw sockets.

## HTTP API Shape

HTTP should handle bootstrap actions only.

### `POST /rooms`

Creates a room and seats the creator as host.

Request:

```ts
{
  displayName: string;
  playerSessionToken?: string;
}
```

Response:

```ts
{
  playerSessionToken: string;
  room: RoomSnapshot;
}
```

If the request has no valid token, the service creates a new player session.

### `POST /rooms/join`

Joins a room by code.

Request:

```ts
{
  roomCode: string;
  displayName: string;
  playerSessionToken?: string;
}
```

Response:

```ts
{
  playerSessionToken: string;
  room: RoomSnapshot;
}
```

## WebSocket API Shape

The client should use one WebSocket connection.

The socket starts as a generic authenticated live connection. It can then
subscribe to a room or game session.

Suggested client messages:

```ts
{
  type: "subscribe_room";
  roomId: string;
}
{
  type: "room_set_ready";
  roomId: string;
  ready: boolean;
}
{
  type: "room_leave";
  roomId: string;
}
{
  type: "room_start_game";
  roomId: string;
}
{
  type: "subscribe_game";
  gameSessionId: string;
}
{
  type: "game_command";
  gameSessionId: string;
  command: unknown;
}
```

Suggested server messages:

```ts
{ type: "room_updated"; room: RoomSnapshot }
{ type: "game_started"; gameSessionId: string }
{ type: "game_updated"; stateVersion: number; view: unknown; events: unknown[] }
{ type: "game_ended"; result: GameEndedPayload }
{ type: "error"; code: string; message?: string }
```

The exact message schemas can evolve during implementation, but the protocol
should remain:

- explicit
- serializable
- phase-aware

## Business Flow

### Create Room

1. HTTP handler validates request body.
2. `roomService.createRoom(...)` resolves or creates player session.
3. Room service generates random room code.
4. Store inserts `rooms` and host `room_players`.
5. Service returns room snapshot and player session token.

### Join Room

1. HTTP handler validates request body.
2. `roomService.joinRoom(...)` resolves or creates player session.
3. Room service loads open room by code.
4. Room service checks capacity and display-name uniqueness.
5. Store inserts `room_players`.
6. Service returns updated room snapshot and token.
7. Notifier publishes `room_updated`.

### Ready / Unready

1. WebSocket receives `room_set_ready`.
2. WebSocket module calls `roomService.setReady(...)`.
3. Service verifies room membership.
4. Store updates readiness.
5. Service loads room snapshot.
6. Notifier publishes `room_updated`.

### Start Game

1. WebSocket receives `room_start_game`.
2. WebSocket module calls `roomService.startGame(...)`.
3. Service verifies host, player count, and readiness.
4. Service coordinates with `gameSessionService.createGameSessionFromRoom(...)`.
5. Transaction creates game session and game-session players.
6. Transaction deletes room rows.
7. Notifier publishes `game_started`.
8. WebSocket subscription target switches from room to game session.

### Submit Command

1. WebSocket receives `game_command`.
2. WebSocket module calls `gameSessionService.submitCommand(...)`.
3. Service locks game session.
4. Service loads player mapping.
5. Service executes command through `tabletop-engine`.
6. Service persists canonical state and increments `state_version`.
7. Service commits transaction.
8. Notifier publishes visible state/events to game participants.

### Disconnect During Active Game

1. WebSocket close event resolves active subscription.
2. If player was in a pre-game room, remove or mark room presence according to
   room rules.
3. If player was in an active game and cannot resume, call
   `gameSessionService.markDisconnected(...)`.
4. Service invalidates the game.
5. Notifier publishes terminal result.
6. Store deletes active game rows.

## Testing Strategy

Use colocated tests for module behavior:

```text
modules/room/__tests__/
modules/game-session/__tests__/
modules/session/__tests__/
modules/websocket/__tests__/
```

Use top-level integration tests only when a test crosses several modules or
needs full HTTP/WebSocket behavior.

Recommended testing layers:

- pure utility tests for token/code normalization
- service tests with fake dependencies for business rules
- store tests against a test database when persistence behavior matters
- Elysia `app.handle(...)` tests for HTTP route behavior
- WebSocket integration tests later, once the protocol stabilizes

## Recommendation

Implement the backend in this order:

1. config + db modules
2. session service/store
3. room service/store + HTTP create/join
4. websocket registry/notifier
5. room WebSocket actions
6. game-session service/store
7. game command execution over WebSocket

This sequence keeps the first working vertical slice small while preserving the
long-term internal boundaries.
