# Reconnect Heartbeat Review Comments

This note captures the review feedback for PR #25 and the resolution direction.
The comments are correctness issues in the hosted Splendor server, not
engine-level issues.

## 1. SIGTERM Must Complete Shutdown

Status: fixed.

File: `examples/splendor/server/src/index.ts`

The new `SIGTERM` and `SIGINT` handlers call `shutdownService.handleSigterm()`,
but they do not stop the Elysia listener or otherwise let the process terminate.
Because installing a signal handler overrides the runtime's default termination
behavior, the process can stay alive with heartbeat and cleanup already stopped.

Required fix direction:

- After sending `server_restarting` and closing live sockets, stop the HTTP
  listener or explicitly continue process shutdown.
- Local Ctrl-C and Render SIGTERM should not leave a half-disabled server
  process running.

## 2. Do Not Start A Room With Disconnected Players

Status: fixed.

File: `examples/splendor/server/src/modules/room/service.ts`

`markDisconnected()` preserves `isReady`. A player can be ready, disconnect,
and remain counted as ready. `startGame()` currently checks readiness but not
`disconnectedAt`, so the host can start the game while a seated player is still
inside the reconnect grace window.

The resulting game session does not inherit the room disconnect marker. The room
is deleted after game creation, so cleanup no longer has a disconnected room row
or a disconnected game row to process.

Resolution:

- `startGame()` now rejects when any seated room player has
  `disconnectedAt !== null`.
- Added a regression test where a ready player disconnects and the host attempts
  to start.

## 3. Recheck Game Disconnect State During Cleanup

Status: fixed with soft grace semantics.

File: `examples/splendor/server/src/modules/game-session/service.ts`

`cleanupExpiredDisconnects()` first loads expired player IDs, then later loads
the game snapshot and deletes the game if the player still exists. A reconnect
can happen between those two steps and clear `disconnectedAt`. The cleanup path
would still delete the game because it only checks player existence.

Resolution:

- After loading the current game snapshot, re-read the player's current
  `disconnectedAt` value.
- Only delete the game if `disconnectedAt` is still non-null and older than the
  cleanup threshold.
- Longer-term, this should become conditional or transactional at the store
  level if horizontal scaling is introduced.

Chosen semantic: Option A, soft grace. If a player reconnects before cleanup
actually deletes the game, the reconnect wins and cleanup skips that game. The
deadline is enforced by cleanup processing, not by an exact hard timestamp in
`markReconnected()`.

## 4. Recheck Room Disconnect State During Cleanup

Status: fixed with soft grace semantics.

File: `examples/splendor/server/src/modules/room/service.ts`

`cleanupExpiredDisconnects()` has the same stale-list race for room seats. A
player can reconnect after the expired IDs are loaded but before the current room
snapshot is processed. The cleanup path currently removes the player if they
still exist, even if their `disconnectedAt` marker was already cleared.

Resolution:

- After loading the current room snapshot, re-read the player's current
  `disconnectedAt` value.
- Only remove the room player if `disconnectedAt` is still non-null and older
  than the cleanup threshold.
- This avoids removing a seat immediately after a successful reconnect.

Chosen semantic: Option A, soft grace. If a room player reconnects before
cleanup actually removes the seat, the reconnect wins and cleanup skips that
seat.
