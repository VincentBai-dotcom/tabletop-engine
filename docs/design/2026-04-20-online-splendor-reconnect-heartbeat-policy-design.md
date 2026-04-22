# Online Splendor Reconnect And Heartbeat Policy Design

## Purpose

This document defines the reconnect, heartbeat, and graceful-shutdown policy for
the hosted Splendor backend.

It builds on:

- [Online Splendor Hosted Requirements](./2026-04-17-online-splendor-hosted-requirements-design.md)
- [Online Splendor Backend Stack](./2026-04-18-online-splendor-backend-stack-design.md)
- [Online Splendor Backend API And Code Organization](./2026-04-19-online-splendor-backend-api-organization-design.md)

The policy follows Render's WebSocket guidance:

- Render does not enforce a fixed maximum WebSocket duration, but connections
  can be interrupted by instance shutdowns, deploys, maintenance, and network
  issues.
- Servers and clients should use keepalive messages, usually WebSocket
  `ping`/`pong`, to detect stale connections.
- Clients should reconnect with exponential backoff.
- Clients are not guaranteed to reconnect to the same instance.
- During instance shutdown, Render sends `SIGTERM` and provides a 30-second
  graceful shutdown window by default. The server can close WebSocket
  connections gracefully and optionally send a shutdown-specific message first.

Source: [Render WebSockets documentation](https://render.com/docs/websocket#handling-instance-shutdown).

## Goals

- Support same-browser reconnect during refresh, temporary network loss, and
  Render instance replacement.
- Avoid invalidating an active game immediately when a socket closes.
- Preserve the product rule that a player who truly leaves an active game makes
  that game invalid.
- Keep the v1 backend simple and Postgres-backed.
- Avoid Redis or cross-instance pub/sub for the first hosted slice.

## Non-Goals

- Cross-device recovery.
- Public account identity.
- Multi-instance real-time fanout.
- Long-term game persistence after completion.
- Spectator reconnect.

## Key Decision

WebSocket close is not a game-ending event by itself.

Close transitions a seated player into a temporary disconnected state. The
server gives that player a short grace window to reconnect from the same
browser/device. If the grace window expires while the player is still
disconnected, the server applies the product rule:

- pre-game room: remove that player from the room
- active game: invalidate and end the game

Explicit user actions still take effect immediately:

- `room_leave` removes the player from the room immediately
- future explicit `game_leave` should invalidate the active game immediately

This distinction matters because browser refresh, Render deploys, and short
network interruptions look like WebSocket close events from the server's point
of view.

## Connection Model

Each browser stores:

- `playerSessionToken`
- current `roomId`, when in a pre-game room
- current `gameSessionId`, when in an active game

On WebSocket open:

1. Client connects to `/live?playerSessionToken=...`.
2. Server resolves the player session from the token.
3. Server registers the socket in the in-memory live registry for the current
   process.
4. Client sends `subscribe_room` or `subscribe_game`.
5. Server clears any persisted disconnected marker for that player in the
   subscribed room or game.
6. Server sends the latest room snapshot or per-player game view.

The in-memory live registry remains only a connection fanout optimization. It
must not be the source of truth for whether a player is still seated, whether a
game is valid, or whether the player can resume.

## Heartbeat Policy

### Server-Side Heartbeat

The server pings all live sockets every 30 seconds.

For each connection:

- mark it as awaiting pong
- send a WebSocket `ping`
- if no `pong` arrives by the next heartbeat tick, terminate the stale socket

Terminating a stale socket follows the same path as a normal close:

- unregister the in-memory connection
- mark the subscribed room/game player as temporarily disconnected
- schedule or rely on cleanup to enforce expiration after the grace window

Implementation note: the v1 server keeps awaiting-pong state inside the
heartbeat manager rather than in the live registry. `LIVE_HEARTBEAT_TIMEOUT_MS`
is reserved for a stricter per-connection timeout, but the current
implementation uses the next 30-second heartbeat tick as the timeout boundary.

### Client-Side Heartbeat

The web client should also detect stale connections.

The browser WebSocket API does not expose protocol-level `ping`, so the client
should use an application-level heartbeat if needed:

```ts
{ type: "client_ping", sentAt: number }
{ type: "server_pong", sentAt: number }
```

For v1, this is optional if server-side ping is reliable in Bun/Elysia and the
client reconnects on `close` and `error`.

## Reconnect Policy

The client reconnects on both graceful and unexpected close.

Reconnect uses exponential backoff:

- first retry: 1 second
- then 2 seconds, 4 seconds, 8 seconds, etc.
- cap delay at 30 seconds
- keep retrying while the user is still on the room/game screen

On successful reconnect:

1. reset backoff
2. reconnect with the stored `playerSessionToken`
3. resubscribe to the current room or game
4. receive the latest room snapshot or game view

If the backend responds with `room_not_found`, `game_not_found`, or
`game_ended`, the client should stop reconnecting and show the appropriate main
menu or end screen.

## Grace Window

Use one grace window for v1:

```ts
DISCONNECT_GRACE_MS = 45_000;
```

Rationale:

- Render's default shutdown window is 30 seconds.
- A 45-second grace window gives the client enough time to observe close, back
  off, reconnect, and resubscribe after a deploy or instance replacement.
- It is still short enough that an abandoned active game ends quickly.

If this feels too aggressive during real testing, increase to 90 seconds before
adding more infrastructure.

## Database Presence State

Because Render can reconnect a client to a different instance, reconnect state
must be recoverable from shared storage. For v1, use Postgres.

### `room_players`

Add:

```ts
disconnected_at: timestamp with time zone null
```

Meaning:

- `null`: player is currently connected or has not been observed disconnected
- non-null: player has a reserved seat but is inside the reconnect grace window

This is not a duplicate of `player_sessions.last_seen_at`.

- `player_sessions.last_seen_at` describes anonymous browser identity activity.
- `room_players.disconnected_at` describes temporary room seat presence.

### `game_session_players`

The table already has:

```ts
disconnected_at: timestamp with time zone null
```

Use it as the active-game reconnect marker.

On reconnect/subscription:

- clear `game_session_players.disconnected_at`
- return the latest per-player visible view

On close:

- set `disconnected_at = now()` for that player in that game session

On cleanup after grace expires:

- delete the game session
- emit or retain a terminal result payload long enough for connected clients to
  see the end screen

## Server Messages

Add these server messages:

```ts
{
  type: "server_restarting";
  reconnectAfterMs: number;
}
{
  type: "room_snapshot";
  room: RoomSnapshot;
}
{
  type: "game_snapshot";
  stateVersion: number;
  view: unknown;
  events: [];
}
{
  type: "player_disconnected";
  playerSessionId: string;
  graceExpiresAt: string;
}
{
  type: "player_reconnected";
  playerSessionId: string;
}
{
  type: "game_ended";
  result: GameEndedPayload;
}
```

`room_snapshot` and `game_snapshot` are sent after subscribe/reconnect. Existing
`room_updated` and `game_updated` remain fanout messages for live changes.

## Graceful Shutdown Policy

On `SIGTERM`:

1. Stop the heartbeat loop.
2. Stop the disconnect cleanup cron job.
3. Send every live socket:

```ts
{
  type: "server_restarting";
  reconnectAfterMs: 1000;
}
```

4. Close each socket with a service-restart close code, preferably `1012`.
5. Do not invalidate games or remove room seats immediately.
6. Let clients reconnect to another instance and resubscribe.
7. Continue normal process shutdown.

The v1 implementation does not add an explicit app-wide `draining` mode. If we
observe clients opening new sockets during Render shutdown, add that as a
follow-up at the Elysia route boundary.

The backend does not need to save canonical game state during shutdown because
accepted commands are already persisted after every accepted command.

The backend also does not need to save the in-memory subscription registry.
Clients restore subscriptions from browser-local `roomId` or `gameSessionId`.

## Cleanup Model

Use a simple database cleanup loop in the server process for v1. The current
implementation schedules this loop with `@elysiajs/cron` rather than a manual
`setInterval`, so the lifecycle is owned by the Elysia app boundary.

Every 5 seconds:

1. Find `room_players.disconnected_at < now - DISCONNECT_GRACE_MS`.
2. Remove those room players.
3. Apply room host transfer or room deletion as needed.
4. Find `game_session_players.disconnected_at < now - DISCONNECT_GRACE_MS`.
5. Invalidate and delete those game sessions.
6. Publish best-effort live updates to connections on the current instance.

This is acceptable for a single Render instance.

For multiple Render instances, this loop needs an ownership/locking mechanism so
only one instance processes a stale row. Use a Postgres transaction with row
locking or a lightweight advisory lock before enabling horizontal scaling.

## Single-Instance Assumption For V1

The current live registry is process-local. That means real-time fanout only
works reliably when all connected clients for a room/game are on the same server
instance.

Render documentation states that reconnects are not guaranteed to return to the
same instance, and horizontal scaling randomly distributes WebSocket
connections.

Therefore:

- v1 should deploy as one Render web service instance
- reconnect correctness should rely on Postgres state, not the in-memory
  registry
- multi-instance support should be deferred until there is a shared fanout
  layer, probably Render Key Value / Redis-compatible pub-sub or Postgres
  `LISTEN/NOTIFY`

## Error Handling

If a reconnect happens after the grace cleanup already ended the room/game:

- `subscribe_room` returns `room_not_found`
- `subscribe_game` returns `game_not_found` or `game_ended`
- client stops reconnecting and shows main menu or end screen

If a stale socket later sends a command after being replaced:

- reject with `live_connection_not_registered` or `stale_connection`

Only the latest connection for a `playerSessionId` is authoritative.

## Testing Strategy

Service tests:

- close marks room player disconnected without removing immediately
- reconnect clears room disconnected marker
- expired room disconnect removes player and transfers host
- expired last room player deletes room
- close marks game player disconnected without deleting immediately
- reconnect clears game disconnected marker
- expired game disconnect invalidates and deletes game

WebSocket tests:

- open registers by player session token
- duplicate connection replaces old connection
- close records temporary disconnect for current subscription
- `server_restarting` close does not invalidate game immediately
- reconnect and resubscribe sends `room_snapshot` or `game_snapshot`

Operational tests:

- simulate `SIGTERM`
- assert server sends `server_restarting`
- assert sockets close
- assert game state remains persisted

## Implementation Notes

This design intentionally keeps the engine untouched. Reconnect and heartbeat
are hosting concerns owned by the Splendor server example.

The current backend should be refactored so WebSocket `close` calls a domain
service instead of only unregistering from the live registry. The service should
decide whether the subscription was a room or a game and mark the correct
presence row as temporarily disconnected.

The cleanup loop should be small and explicit. Do not introduce a generic job
runner for this pass.
