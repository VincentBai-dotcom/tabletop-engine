# Online Splendor Reconnect Heartbeat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Render-aware WebSocket heartbeat, reconnect, temporary disconnect grace handling, and graceful shutdown for the hosted Splendor backend.

**Architecture:** Keep the engine unchanged. The Splendor server owns reconnect semantics through Postgres-backed presence markers, a process-local live connection registry for fanout, and small domain services that convert socket close/reconnect into room/game presence updates. WebSocket close should mark a player temporarily disconnected, while an explicit leave still removes or invalidates immediately.

**Tech Stack:** Bun, Elysia WebSocket, Drizzle ORM, PostgreSQL, colocated Bun tests, `tabletop-engine`, `splendor-example`.

---

## Context

Read these docs before implementation:

- `docs/design/2026-04-20-online-splendor-reconnect-heartbeat-policy-design.md`
- `docs/design/2026-04-19-online-splendor-backend-api-organization-design.md`
- Render WebSocket docs: `https://render.com/docs/websocket#handling-instance-shutdown`
- Elysia WebSocket docs from `examples/splendor/server/llms.txt`

Current relevant files:

- `examples/splendor/server/src/modules/websocket/routes.ts`
- `examples/splendor/server/src/modules/websocket/actions.ts`
- `examples/splendor/server/src/modules/websocket/registry.ts`
- `examples/splendor/server/src/modules/websocket/model.ts`
- `examples/splendor/server/src/modules/room/model.ts`
- `examples/splendor/server/src/modules/room/service.ts`
- `examples/splendor/server/src/modules/room/store.ts`
- `examples/splendor/server/src/modules/game-session/model.ts`
- `examples/splendor/server/src/modules/game-session/service.ts`
- `examples/splendor/server/src/modules/game-session/store.ts`
- `examples/splendor/server/src/schema/room.ts`
- `examples/splendor/server/src/schema/game-session.ts`
- `examples/splendor/server/src/index.ts`
- `examples/splendor/server/src/app.ts`

Use TDD:

- Write a focused failing test.
- Run it and verify it fails for the expected reason.
- Implement the minimum code.
- Run the test and related checks.
- Commit small steps.

## Constants

Create one shared config file for reconnect timing:

```ts
export const LIVE_HEARTBEAT_INTERVAL_MS = 30_000;
export const LIVE_HEARTBEAT_TIMEOUT_MS = 10_000;
export const DISCONNECT_GRACE_MS = 45_000;
export const DISCONNECT_CLEANUP_CRON_PATTERN = "*/5 * * * * *";
export const SERVER_RESTART_RECONNECT_AFTER_MS = 1_000;
export const SERVER_RESTART_CLOSE_CODE = 1012;
```

For tests, do not rely on real timers unless testing timer wiring. Prefer
injecting a fake clock and calling service methods directly.

## Task 1: Add Room Presence Schema

**Files:**

- Modify: `examples/splendor/server/src/schema/room.ts`
- Modify: `examples/splendor/server/src/schema/__tests__/schema.test.ts`
- Add migration: `examples/splendor/server/drizzle/<next>_add_room_player_disconnect.sql`
- Modify generated metadata under `examples/splendor/server/drizzle/meta/` if Drizzle generated snapshots are committed in this repo.

**Step 1: Write the failing schema test**

In `examples/splendor/server/src/schema/__tests__/schema.test.ts`, assert that
`roomPlayers.disconnectedAt` exists.

Expected test shape:

```ts
import { roomPlayers } from "../room";

it("tracks temporary room disconnects", () => {
  expect(roomPlayers.disconnectedAt).toBeDefined();
});
```

**Step 2: Run the schema test and verify red**

Run:

```bash
bun test --cwd examples/splendor/server ./src/schema/__tests__/schema.test.ts
```

Expected: FAIL because `roomPlayers.disconnectedAt` does not exist.

**Step 3: Add the schema field**

In `examples/splendor/server/src/schema/room.ts`, add:

```ts
disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
```

to `roomPlayers`.

Also add an index:

```ts
index("idx_room_players_disconnected_at").on(table.disconnectedAt),
```

**Step 4: Add or generate migration**

Preferred:

```bash
bunx drizzle-kit generate --config examples/splendor/server/drizzle.config.ts
```

If the generated name differs, keep the generated name. The SQL should include:

```sql
ALTER TABLE "room_players" ADD COLUMN "disconnected_at" timestamp with time zone;
CREATE INDEX "idx_room_players_disconnected_at" ON "room_players" USING btree ("disconnected_at");
```

If the command cannot run cleanly because of local DB/tooling assumptions, write
the migration manually and note the reason in the final summary.

**Step 5: Run schema verification**

Run:

```bash
bun test --cwd examples/splendor/server ./src/schema/__tests__/schema.test.ts
bunx tsc -p examples/splendor/server/tsconfig.json --noEmit
bunx eslint examples/splendor/server
```

Expected: all pass.

**Step 6: Commit**

```bash
git add examples/splendor/server/src/schema examples/splendor/server/drizzle
git commit -m "feat: add room disconnect presence schema"
```

## Task 2: Extend Room Presence Store And Service

**Files:**

- Modify: `examples/splendor/server/src/modules/room/model.ts`
- Modify: `examples/splendor/server/src/modules/room/store.ts`
- Modify: `examples/splendor/server/src/modules/room/service.ts`
- Modify: `examples/splendor/server/src/modules/room/__tests__/service.test.ts`

**Step 1: Write failing room service tests**

Add tests for these behaviors:

1. `markDisconnected` sets a disconnected timestamp and keeps the player seated.
2. `markReconnected` clears the disconnected timestamp and broadcasts a room update.
3. `cleanupExpiredDisconnects` removes an expired disconnected non-host player.
4. `cleanupExpiredDisconnects` transfers host when the expired player was host.
5. `cleanupExpiredDisconnects` deletes the room when the expired player was the last player.

Use the existing fake store in `room/__tests__/service.test.ts`. Extend fake
players to include `disconnectedAt: Date | null`.

Expected interface shape:

```ts
await service.markDisconnected({
  roomId: "room-1",
  playerSessionId: "host",
  disconnectedAt: now,
});

await service.markReconnected({
  roomId: "room-1",
  playerSessionId: "host",
});

await service.cleanupExpiredDisconnects({
  olderThan: new Date("2026-04-20T12:00:45.000Z"),
});
```

**Step 2: Run room service tests and verify red**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/room/__tests__/service.test.ts
```

Expected: FAIL because the new service methods do not exist.

**Step 3: Update room models**

In `RoomPlayerSnapshot`, add:

```ts
disconnectedAt: Date | null;
```

In `RoomStore`, add:

```ts
markRoomPlayerDisconnected(input: {
  roomId: string;
  playerSessionId: string;
  disconnectedAt: Date;
}): Promise<RoomSnapshot>;

clearRoomPlayerDisconnected(input: {
  roomId: string;
  playerSessionId: string;
}): Promise<RoomSnapshot>;

loadExpiredDisconnectedRoomPlayers(input: {
  olderThan: Date;
}): Promise<Array<{ roomId: string; playerSessionId: string }>>;
```

In `RoomService`, add:

```ts
markDisconnected(input: {
  roomId: string;
  playerSessionId: string;
  disconnectedAt: Date;
}): Promise<RoomActionResult>;

markReconnected(input: {
  roomId: string;
  playerSessionId: string;
}): Promise<RoomActionResult>;

cleanupExpiredDisconnects(input: {
  olderThan: Date;
}): Promise<void>;
```

**Step 4: Implement room service behavior**

Implement:

- `markDisconnected`: validate room is open and player is seated, set
  `disconnectedAt`, publish `room_updated`.
- `markReconnected`: validate room exists/open if still present, clear
  `disconnectedAt`, publish `room_updated`.
- `cleanupExpiredDisconnects`: load expired disconnected room players, call the
  existing leave/remove logic for each, and publish updates through that path.

Avoid duplicating host-transfer logic. Extract a private helper:

```ts
async function removeSeatedPlayer(room: RoomSnapshot, playerSessionId: string) {
  // existing leaveRoom body after validation
}
```

`room_leave` remains immediate and should not set `disconnectedAt`.

**Step 5: Implement room store behavior**

In `mapRoomSnapshot`, map:

```ts
disconnectedAt: player.disconnectedAt,
```

Implement store methods with room-scoped `where(and(...))` filters.

`loadExpiredDisconnectedRoomPlayers` should query rows where:

```ts
isNotNull(roomPlayers.disconnectedAt);
lt(roomPlayers.disconnectedAt, olderThan);
```

Return only `{ roomId, playerSessionId }`.

**Step 6: Verify**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/room/__tests__/service.test.ts
bunx tsc -p examples/splendor/server/tsconfig.json --noEmit
bunx eslint examples/splendor/server
```

Expected: all pass.

**Step 7: Commit**

```bash
git add examples/splendor/server/src/modules/room
git commit -m "feat: add room reconnect presence handling"
```

## Task 3: Extend Game Session Reconnect Service

**Files:**

- Modify: `examples/splendor/server/src/modules/game-session/model.ts`
- Modify: `examples/splendor/server/src/modules/game-session/store.ts`
- Modify: `examples/splendor/server/src/modules/game-session/service.ts`
- Modify: `examples/splendor/server/src/modules/game-session/__tests__/service.test.ts`

**Step 1: Write failing game-session tests**

Add tests for:

1. `markDisconnected` marks disconnected but does not delete immediately.
2. `markReconnected` clears the marker and returns the player-specific latest view.
3. `cleanupExpiredDisconnects` invalidates and deletes games whose disconnected
   player has exceeded the grace threshold.
4. `getPlayerSnapshot` returns `game_snapshot` payload for reconnect/subscribe.

Expected result shape:

```ts
const snapshot = await service.getPlayerSnapshot({
  gameSessionId: "game-1",
  playerSessionId: "session-host",
});

expect(snapshot).toEqual({
  gameSessionId: "game-1",
  stateVersion: 0,
  playerId: "player-1",
  view: expect.any(Object),
});
```

**Step 2: Run game-session tests and verify red**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/game-session/__tests__/service.test.ts
```

Expected: FAIL because methods do not exist and existing `markDisconnected`
deletes immediately.

**Step 3: Update models**

In `GameSessionStore`, add:

```ts
clearPlayerDisconnected(input: {
  gameSessionId: string;
  playerSessionId: string;
}): Promise<GameSessionSnapshot<TState> | null>;

loadExpiredDisconnectedGamePlayers(input: {
  olderThan: Date;
}): Promise<Array<{ gameSessionId: string; playerSessionId: string }>>;
```

In `GameSessionService`, change `markDisconnected` semantics:

```ts
markDisconnected(input: MarkDisconnectedInput): Promise<GameSessionSnapshot | null>;
```

Add:

```ts
markReconnected(input: MarkDisconnectedInput): Promise<GamePlayerSnapshot | null>;
getPlayerSnapshot(input: MarkDisconnectedInput): Promise<GamePlayerSnapshot>;
cleanupExpiredDisconnects(input: { olderThan: Date }): Promise<GameEndedResult[]>;
```

Define:

```ts
export interface GamePlayerSnapshot {
  gameSessionId: string;
  stateVersion: number;
  playerSessionId: string;
  playerId: string;
  view: unknown;
}
```

**Step 4: Implement game service behavior**

Implement:

- `markDisconnected`: set `disconnectedAt`, do not delete the game.
- `markReconnected`: clear `disconnectedAt`, return the latest player snapshot.
- `getPlayerSnapshot`: load game, validate player membership, return view for
  that player.
- `cleanupExpiredDisconnects`: find expired players, delete each game session,
  return `GameEndedResult[]` with `reason: "invalidated"` and message
  `"A seated player disconnected"`.

Keep explicit future `game_leave` separate. Do not add it in this task.

**Step 5: Implement game store behavior**

Implement:

- `clearPlayerDisconnected`: update `game_session_players.disconnected_at` to
  null with both `gameSessionId` and `playerSessionId` in the `where`.
- `loadExpiredDisconnectedGamePlayers`: query
  `game_session_players.disconnected_at < olderThan`.

**Step 6: Verify**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/game-session/__tests__/service.test.ts
bunx tsc -p examples/splendor/server/tsconfig.json --noEmit
bunx eslint examples/splendor/server
```

Expected: all pass.

**Step 7: Commit**

```bash
git add examples/splendor/server/src/modules/game-session
git commit -m "feat: add game reconnect presence handling"
```

## Task 4: Add Live Presence Service For WebSocket Close And Subscribe

**Files:**

- Create: `examples/splendor/server/src/modules/live-presence/model.ts`
- Create: `examples/splendor/server/src/modules/live-presence/service.ts`
- Create: `examples/splendor/server/src/modules/live-presence/index.ts`
- Create: `examples/splendor/server/src/modules/live-presence/__tests__/service.test.ts`
- Modify: `examples/splendor/server/src/modules/websocket/model.ts`
- Modify: `examples/splendor/server/src/modules/websocket/actions.ts`
- Modify: `examples/splendor/server/src/modules/websocket/routes.ts`
- Modify: `examples/splendor/server/src/modules/websocket/__tests__/actions.test.ts`
- Modify: `examples/splendor/server/src/modules/websocket/__tests__/websocket-actions.test.ts`

**Step 1: Write failing live-presence tests**

Test the service directly:

- `handleClosedSubscription` calls room `markDisconnected` for room subscription.
- `handleClosedSubscription` calls game `markDisconnected` for game subscription.
- `handleRoomSubscribed` clears room disconnected marker and returns
  `{ type: "room_snapshot", room }`.
- `handleGameSubscribed` clears game disconnected marker and returns
  `{ type: "game_snapshot", stateVersion, view, events: [] }`.

Expected service shape:

```ts
const service = createLivePresenceService({
  clock,
  roomService,
  gameSessionService,
});

await service.handleClosedSubscription({
  playerSessionId: "session-1",
  subscription: { type: "room", roomId: "room-1" },
});
```

**Step 2: Run live-presence tests and verify red**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/live-presence/__tests__/service.test.ts
```

Expected: FAIL because module does not exist.

**Step 3: Implement live-presence module**

`model.ts`:

```ts
import type { LiveSubscription, LiveServerMessage } from "../websocket";

export interface ClosedSubscriptionInput {
  playerSessionId: string;
  subscription: LiveSubscription | null;
}

export interface LivePresenceService {
  handleClosedSubscription(input: ClosedSubscriptionInput): Promise<void>;
  handleRoomSubscribed(input: {
    playerSessionId: string;
    roomId: string;
  }): Promise<LiveServerMessage>;
  handleGameSubscribed(input: {
    playerSessionId: string;
    gameSessionId: string;
  }): Promise<LiveServerMessage>;
}
```

`service.ts` depends on:

- `Clock`
- `RoomService`
- `GameSessionService`

Close behavior:

- null subscription: no-op
- room subscription: `roomService.markDisconnected({ ..., disconnectedAt: now })`
- game subscription: `gameSessionService.markDisconnected({ ... })`

Subscribe behavior:

- room: `roomService.markReconnected(...)`, return `room_snapshot`
- game: `gameSessionService.markReconnected(...)`, return `game_snapshot`

If reconnect returns null because room/game is gone, throw the underlying
`AppError` from room/game service.

**Step 4: Extend WebSocket message types**

In `websocket/model.ts`, add server messages:

```ts
| { type: "room_snapshot"; room: RoomSnapshot }
| { type: "game_snapshot"; stateVersion: number; view: unknown; events: [] }
| { type: "player_disconnected"; playerSessionId: string; graceExpiresAt: string }
| { type: "player_reconnected"; playerSessionId: string }
| { type: "server_restarting"; reconnectAfterMs: number }
```

Do not add client `client_ping` yet unless Task 6 requires it.

**Step 5: Wire subscribe actions**

Modify `createLiveMessageHandler` deps to include `livePresenceService`.

For `subscribe_room`:

1. `registry.subscribeToRoom(...)`
2. `const snapshot = await livePresenceService.handleRoomSubscribed(...)`
3. `connection.send(snapshot)`

For `subscribe_game`:

1. `registry.subscribeToGame(...)`
2. call `handleGameSubscribed`
3. send `game_snapshot`

Update existing tests so subscribe actions now expect snapshot messages.

**Step 6: Wire close in routes**

Modify `createWebSocketRoutes` deps to include `livePresenceService`.

In `close(ws)`:

```ts
const removed = registry.removeConnection(ws.id);
if (removed) {
  void livePresenceService.handleClosedSubscription(removed);
}
```

Use `void` because Elysia close cannot reliably await long cleanup. The service
method itself should catch/log expected cleanup errors if necessary, or route
should attach `.catch(console.error)`.

**Step 7: Verify**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/live-presence/__tests__/service.test.ts ./src/modules/websocket/__tests__/actions.test.ts ./src/modules/websocket/__tests__/websocket-actions.test.ts
bunx tsc -p examples/splendor/server/tsconfig.json --noEmit
bunx eslint examples/splendor/server
```

Expected: all pass.

**Step 8: Commit**

```bash
git add examples/splendor/server/src/modules/live-presence examples/splendor/server/src/modules/websocket
git commit -m "feat: wire reconnect presence into websocket lifecycle"
```

## Task 5: Add Elysia Cron Cleanup Job

**Files:**

- Create: `examples/splendor/server/src/modules/disconnect-cleanup/model.ts`
- Create: `examples/splendor/server/src/modules/disconnect-cleanup/service.ts`
- Create: `examples/splendor/server/src/modules/disconnect-cleanup/plugin.ts`
- Create: `examples/splendor/server/src/modules/disconnect-cleanup/index.ts`
- Create: `examples/splendor/server/src/modules/disconnect-cleanup/__tests__/service.test.ts`
- Create: `examples/splendor/server/src/modules/disconnect-cleanup/__tests__/plugin.test.ts`
- Create: `examples/splendor/server/src/lib/time.ts`
- Modify: `examples/splendor/server/package.json`
- Modify: `bun.lock`
- Modify: `examples/splendor/server/src/app.ts`
- Modify: `examples/splendor/server/src/index.ts`

**Step 1: Write failing cleanup service tests**

Test:

- computes `olderThan = now - DISCONNECT_GRACE_MS`
- calls `roomService.cleanupExpiredDisconnects({ olderThan })`
- calls `gameSessionService.cleanupExpiredDisconnects({ olderThan })`
- publishes `game_ended` for each expired game result
- returns cleanup counts

Expected service shape:

```ts
const cleanup = createDisconnectCleanupService({
  clock,
  roomService,
  gameSessionService,
  notifier,
  disconnectGraceMs: 45_000,
});

const result = await cleanup.runOnce();
expect(result).toEqual({ roomsProcessed: 1, gamesEnded: 1 });
```

**Step 2: Run cleanup tests and verify red**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/disconnect-cleanup/__tests__/service.test.ts
```

Expected: FAIL because module does not exist.

**Step 3: Install Elysia cron plugin**

Run:

```bash
BUN_INSTALL=/tmp/bun-install BUN_TMPDIR=/tmp/bun-tmp bun add --cwd examples/splendor/server @elysiajs/cron
```

Expected:

- `examples/splendor/server/package.json` includes `@elysiajs/cron`
- `bun.lock` updates

If package installation is blocked by sandbox or network restrictions, request
escalation with the same command.

**Step 4: Implement cleanup service**

`createDisconnectCleanupService` should expose:

```ts
runOnce(): Promise<{ roomsProcessed: number; gamesEnded: number }>;
```

Implementation:

```ts
const olderThan = subtractMilliseconds(clock.now(), disconnectGraceMs);
const roomsProcessed = await roomService.cleanupExpiredDisconnects({
  olderThan,
});
const endedGames = await gameSessionService.cleanupExpiredDisconnects({
  olderThan,
});
for (const ended of endedGames) {
  notifier.publishGameEnded(ended.gameSessionId, ended.result);
}
return { roomsProcessed, gamesEnded: endedGames.length };
```

If `roomService.cleanupExpiredDisconnects` currently returns void from Task 2,
adjust it to return the number of processed expired room players.

Do not put scheduling logic in this service. The service should be directly
testable and callable once.

**Step 5: Add time helper**

Create `examples/splendor/server/src/lib/time.ts`:

```ts
export function subtractMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() - milliseconds);
}
```

**Step 6: Write failing cron plugin tests**

Create `examples/splendor/server/src/modules/disconnect-cleanup/__tests__/plugin.test.ts`.

Test the Elysia plugin wrapper:

- it registers a cron job named `disconnectCleanup`
- it accepts `DISCONNECT_CLEANUP_CRON_PATTERN`
- invoking the cron callback calls `cleanupService.runOnce`

Expected plugin shape:

```ts
const app = new Elysia().use(
  createDisconnectCleanupCron({
    cleanupService,
    pattern: "*/5 * * * * *",
  }),
);
```

If the cron plugin does not expose its callback cleanly for direct tests, keep
plugin tests minimal and rely on `service.test.ts` for cleanup behavior. Do not
test cronner internals.

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/disconnect-cleanup/__tests__/plugin.test.ts
```

Expected: FAIL because plugin module does not exist.

**Step 7: Implement Elysia cron plugin wrapper**

Create `examples/splendor/server/src/modules/disconnect-cleanup/plugin.ts`:

```ts
import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import type { DisconnectCleanupService } from "./model";

export function createDisconnectCleanupCron({
  cleanupService,
  pattern,
}: {
  cleanupService: DisconnectCleanupService;
  pattern: string;
}) {
  return new Elysia({ name: "disconnect-cleanup-cron" }).use(
    cron({
      name: "disconnectCleanup",
      pattern,
      async run() {
        await cleanupService.runOnce();
      },
      catch(error) {
        console.error("disconnect_cleanup_failed", error);
      },
    }),
  );
}
```

The `catch` option is based on the official Elysia cron plugin docs and keeps
one failed cleanup run from disabling future runs.

**Step 8: Wire cleanup cron into app**

Change `examples/splendor/server/src/app.ts` so `createApp` accepts optional
cron/plugin deps:

```ts
export interface AppDeps {
  roomService: RoomService;
  websocket: WebSocketRoutesDeps;
  disconnectCleanup?: {
    cleanupService: DisconnectCleanupService;
    pattern: string;
  };
}
```

Then:

```ts
const app = new Elysia();
// existing plugins/routes

return disconnectCleanup
  ? app.use(createDisconnectCleanupCron(disconnectCleanup))
  : app;
```

This keeps Elysia-specific cron wiring at the app boundary, not in domain
services.

**Step 9: Wire in index**

In `examples/splendor/server/src/index.ts`:

- create cleanup service after `roomService`, `gameSessionService`, and
  `liveNotifier`
- pass it into `createApp` with
  `pattern: DISCONNECT_CLEANUP_CRON_PATTERN`
- do not call `setInterval`

Do not add complex process manager abstractions. Elysia owns the scheduled cron
job lifecycle.

**Step 10: Verify**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/disconnect-cleanup/__tests__/service.test.ts ./src/modules/disconnect-cleanup/__tests__/plugin.test.ts
bunx tsc -p examples/splendor/server/tsconfig.json --noEmit
bunx eslint examples/splendor/server
```

Expected: all pass.

**Step 11: Commit**

```bash
git add examples/splendor/server/package.json bun.lock examples/splendor/server/src/lib/time.ts examples/splendor/server/src/modules/disconnect-cleanup examples/splendor/server/src/app.ts examples/splendor/server/src/index.ts
git commit -m "feat: add disconnect cleanup cron"
```

## Task 6: Add Heartbeat Manager

**Files:**

- Create: `examples/splendor/server/src/modules/websocket/heartbeat.ts`
- Create: `examples/splendor/server/src/modules/websocket/__tests__/heartbeat.test.ts`
- Modify: `examples/splendor/server/src/modules/websocket/model.ts`
- Modify: `examples/splendor/server/src/modules/websocket/registry.ts`
- Modify: `examples/splendor/server/src/modules/websocket/routes.ts`
- Modify: `examples/splendor/server/src/modules/websocket/index.ts`
- Modify: `examples/splendor/server/src/index.ts`

**Step 1: Write failing heartbeat tests**

Test the heartbeat manager with fake connections:

- first tick marks connection as awaiting pong and calls `ping`
- receiving pong clears awaiting state
- second tick terminates a connection that missed pong
- `stop` clears the interval

Define an expanded test connection:

```ts
interface HeartbeatConnection extends LiveConnection {
  ping(): void;
  terminate(): void;
}
```

If Elysia/Bun exposes `ws.ping` and `ws.terminate`, wrap them in
`toLiveConnection`.

**Step 2: Run heartbeat tests and verify red**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/websocket/__tests__/heartbeat.test.ts
```

Expected: FAIL because heartbeat module does not exist.

**Step 3: Extend connection model**

In `LiveConnection`, add optional methods:

```ts
ping?(): void;
terminate?(): void;
```

Add registry support:

```ts
getConnections(): LiveConnection[];
markAwaitingPong(connectionId: string): void;
markPongReceived(connectionId: string): void;
isAwaitingPong(connectionId: string): boolean;
```

Alternatively, keep heartbeat state entirely inside `heartbeat.ts` in a
`Set<string>`. Prefer heartbeat-local state to avoid making registry own
protocol details.

**Step 4: Implement heartbeat manager**

Create:

```ts
export function createHeartbeatManager(deps: {
  registry: LiveConnectionRegistry;
  intervalMs: number;
  onTerminated?: (connection: LiveConnection) => void;
}) {
  function tick() { ... }
  function markPong(connectionId: string) { ... }
  function start(): { stop(): void } { ... }
  return { tick, markPong, start };
}
```

`tick` logic:

```ts
for (const connection of registry.getConnections()) {
  if (awaitingPong.has(connection.id)) {
    connection.terminate?.();
    onTerminated?.(connection);
    continue;
  }

  awaitingPong.add(connection.id);
  connection.ping?.();
}
```

Use one interval of `LIVE_HEARTBEAT_INTERVAL_MS`. Do not create a separate
timeout per connection for v1; the next tick is the timeout. This means stale
connections are terminated after about one missed heartbeat interval. If strict
10-second timeout is required, add per-connection timeout in a later pass.

**Step 5: Wire pong event**

Check Elysia/Bun WebSocket support for `pong` hook. If available, in
`createWebSocketRoutes` call:

```ts
pong(ws) {
  heartbeatManager.markPong(ws.id);
}
```

If Elysia does not expose `pong`, add application-level client heartbeat:

Client message:

```ts
{
  type: "client_pong";
}
```

or:

```ts
{
  type: "client_ping";
  sentAt: number;
}
```

For v1, prefer protocol-level `pong` if supported.

**Step 6: Wire heartbeat in index**

Create heartbeat manager with:

- `registry: liveRegistry`
- `intervalMs: LIVE_HEARTBEAT_INTERVAL_MS`
- `onTerminated`: call the same close cleanup path as normal close if the
  socket termination does not trigger Elysia `close`

Start it in `index.ts`:

```ts
const heartbeat = heartbeatManager.start();
```

Stop it on `SIGTERM`.

Do not move heartbeat to `@elysiajs/cron`. Heartbeat owns per-socket
awaiting-pong state and termination behavior, while cron is only used for the
database cleanup job.

**Step 7: Verify**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/websocket/__tests__/heartbeat.test.ts ./src/modules/websocket/__tests__/registry.test.ts
bunx tsc -p examples/splendor/server/tsconfig.json --noEmit
bunx eslint examples/splendor/server
```

Expected: all pass.

**Step 8: Commit**

```bash
git add examples/splendor/server/src/modules/websocket examples/splendor/server/src/index.ts
git commit -m "feat: add websocket heartbeat manager"
```

## Task 7: Add Graceful Shutdown Handling

**Files:**

- Create: `examples/splendor/server/src/modules/shutdown/model.ts`
- Create: `examples/splendor/server/src/modules/shutdown/service.ts`
- Create: `examples/splendor/server/src/modules/shutdown/index.ts`
- Create: `examples/splendor/server/src/modules/shutdown/__tests__/service.test.ts`
- Modify: `examples/splendor/server/src/modules/websocket/model.ts`
- Modify: `examples/splendor/server/src/modules/websocket/registry.ts`
- Modify: `examples/splendor/server/src/index.ts`

**Step 1: Write failing shutdown tests**

Test:

- sends `{ type: "server_restarting", reconnectAfterMs: 1000 }` to all
  connections
- closes each connection with code `1012`
- stops the heartbeat loop
- stops the Elysia cron cleanup job if a cron handle is provided
- does not call room/game disconnect invalidation directly

Use fake connections:

```ts
close(code?: number, reason?: string): void;
```

**Step 2: Run shutdown tests and verify red**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/shutdown/__tests__/service.test.ts
```

Expected: FAIL because module does not exist.

**Step 3: Extend LiveConnection**

Add optional:

```ts
close?(code?: number, reason?: string): void;
```

Add registry method if not already added:

```ts
getConnections(): LiveConnection[];
```

**Step 4: Implement shutdown service**

`createShutdownService` deps:

```ts
{
  registry: LiveConnectionRegistry;
  heartbeat: { stop(): void };
  cleanupCron?: { stop(): void };
  reconnectAfterMs: number;
  closeCode: number;
}
```

Expose:

```ts
handleSigterm(): void;
```

Implementation:

1. stop heartbeat
2. stop cleanup cron if provided
3. send `server_restarting`
4. close every connection with code `1012` and reason `"server_restarting"`

Do not mark players disconnected from shutdown service. Normal reconnect grace
state is already in DB after actual socket close; if close callbacks do not run
during shutdown, the client still reconnects and resubscribes based on browser
state.

**Step 5: Wire process signal**

In `index.ts`:

```ts
const shutdownService = createShutdownService(...);
process.on("SIGTERM", () => shutdownService.handleSigterm());
```

Optionally handle `SIGINT` for local development.

How to get the cron handle:

- Prefer reading `app.store.cron.disconnectCleanup` if Elysia exposes it with
  stable typing.
- If typing is awkward, pass a minimal adapter from `index.ts`:

```ts
const cleanupCron = app.store.cron?.disconnectCleanup
  ? { stop: () => app.store.cron.disconnectCleanup.stop() }
  : undefined;
```

Do not make shutdown depend on cron internals beyond `.stop()`.

**Step 6: Verify**

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/shutdown/__tests__/service.test.ts
bunx tsc -p examples/splendor/server/tsconfig.json --noEmit
bunx eslint examples/splendor/server
```

Expected: all pass.

**Step 7: Commit**

```bash
git add examples/splendor/server/src/modules/shutdown examples/splendor/server/src/modules/websocket examples/splendor/server/src/index.ts
git commit -m "feat: add websocket graceful shutdown"
```

## Task 8: Update WebSocket Protocol Tests And Docs

**Files:**

- Modify: `examples/splendor/server/src/modules/websocket/__tests__/actions.test.ts`
- Modify: `examples/splendor/server/src/modules/websocket/__tests__/websocket-actions.test.ts`
- Modify: `docs/design/2026-04-20-online-splendor-reconnect-heartbeat-policy-design.md`

**Step 1: Add protocol regression tests**

Add tests for:

- `subscribe_room` sends `room_snapshot`
- `subscribe_game` sends `game_snapshot`
- stale connection command gets `live_connection_not_registered`
- server restart message shape is included in `LiveServerMessage`

Run:

```bash
bun test --cwd examples/splendor/server ./src/modules/websocket/__tests__/actions.test.ts ./src/modules/websocket/__tests__/websocket-actions.test.ts
```

Expected: pass after Tasks 4-7.

**Step 2: Update design doc with implementation deviations**

If the implementation uses heartbeat-local state rather than registry state, add
a short note.

If Elysia lacks `pong` hook and app-level heartbeat is used, update:

- client message type
- server message type
- browser reconnect guidance

**Step 3: Verify docs and code**

Run:

```bash
bun test --cwd examples/splendor/server
bunx tsc -p examples/splendor/server/tsconfig.json --noEmit
bunx eslint examples/splendor/server
```

Expected: all pass.

**Step 4: Commit**

```bash
git add examples/splendor/server/src/modules/websocket docs/design/2026-04-20-online-splendor-reconnect-heartbeat-policy-design.md
git commit -m "docs: align reconnect protocol with implementation"
```

## Task 9: Final Verification

**Files:**

- Modify only as needed for integration fixes.

**Step 1: Run server verification**

```bash
bun test --cwd examples/splendor/server
bunx tsc -p examples/splendor/server/tsconfig.json --noEmit
bunx eslint examples/splendor/server
```

Expected: all pass.

**Step 2: Run broader repo verification**

```bash
bun run lint
bunx tsc -b
bun test --cwd examples/splendor/engine
bun test --cwd examples/splendor/terminal
```

Expected: all pass.

**Step 3: Commit final integration fixes if needed**

Only commit if Step 1 or Step 2 required fixes:

```bash
git add <changed files>
git commit -m "test: verify reconnect heartbeat integration"
```

## Expected End State

After this plan:

- Room players have `disconnectedAt`.
- Room reconnect clears temporary disconnect state.
- Game reconnect clears temporary disconnect state and sends latest view.
- WebSocket close marks subscribed room/game player temporarily disconnected.
- Cleanup loop removes expired room disconnects and invalidates expired game
  disconnects.
- Heartbeat detects stale sockets.
- SIGTERM sends `server_restarting` and closes sockets with code `1012`.
- Clients can reconnect with token + stored room/game id and receive a snapshot.

## Known Deferrals

- Horizontal scaling with shared fanout.
- Redis/Render Key Value pub-sub.
- Strict 10-second pong timeout if protocol-level pong is hard to access in
  Elysia/Bun.
- Explicit `game_leave` message.
- Long-lived terminal game result storage for reconnecting to an already-ended
  game.
