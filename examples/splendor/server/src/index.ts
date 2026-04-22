import { createSplendorExecutor, type SplendorState } from "splendor-example";
import { systemClock } from "./lib/clock";
import { createRandomToken } from "./lib/random";
import {
  DISCONNECT_CLEANUP_CRON_PATTERN,
  DISCONNECT_GRACE_MS,
  LIVE_HEARTBEAT_INTERVAL_MS,
  SERVER_RESTART_CLOSE_CODE,
  SERVER_RESTART_RECONNECT_AFTER_MS,
} from "./lib/reconnect-policy";
import { configService } from "./modules/config";
import { createDbClient } from "./modules/db";
import { createDisconnectCleanupService } from "./modules/disconnect-cleanup";
import {
  createGameSessionService,
  createGameSessionStore,
} from "./modules/game-session";
import { createRoomService, createRoomStore } from "./modules/room";
import {
  createPlayerSessionService,
  createPlayerSessionStore,
} from "./modules/player-session";
import { createShutdownService } from "./modules/shutdown";
import {
  createHeartbeatManager,
  createLiveConnectionRegistry,
  createLiveNotifier,
  handleLiveConnectionClosed,
} from "./modules/websocket";
import { createLivePresenceService } from "./modules/live-presence";
import { createApp } from "./app";

const config = configService.get();
const { db } = createDbClient(config.database.url);
const playerSessionService = createPlayerSessionService({
  store: createPlayerSessionStore(db),
  clock: systemClock,
});
const liveRegistry = createLiveConnectionRegistry();
const liveNotifier = createLiveNotifier(liveRegistry);
const gameSessionService = createGameSessionService<SplendorState>({
  store: createGameSessionStore<SplendorState>(db),
  gameExecutor: createSplendorExecutor(),
  rngSeedGenerator: createRandomToken,
  clock: systemClock,
});
const roomService = createRoomService({
  store: createRoomStore(db),
  resolveOrCreatePlayerSession: (input) =>
    playerSessionService.resolveOrCreatePlayerSession(input),
  notifier: liveNotifier,
  startGameFromRoom: (input) =>
    gameSessionService.createGameSessionFromRoom(input),
});
const livePresenceService = createLivePresenceService({
  clock: systemClock,
  roomService,
  gameSessionService,
});
const heartbeatManager = createHeartbeatManager({
  registry: liveRegistry,
  intervalMs: LIVE_HEARTBEAT_INTERVAL_MS,
  onTerminated(connection) {
    void handleLiveConnectionClosed({
      registry: liveRegistry,
      livePresenceService,
      connectionId: connection.id,
    }).catch((error: unknown) => {
      console.error("live_connection_heartbeat_cleanup_failed", error);
    });
  },
});
const disconnectCleanupService = createDisconnectCleanupService({
  clock: systemClock,
  roomService,
  gameSessionService,
  notifier: liveNotifier,
  disconnectGraceMs: DISCONNECT_GRACE_MS,
});

const app = createApp({
  roomService,
  websocket: {
    registry: liveRegistry,
    gameSessionService,
    roomService,
    livePresenceService,
    heartbeatManager,
    playerSessionService,
  },
  disconnectCleanup: {
    cleanupService: disconnectCleanupService,
    pattern: DISCONNECT_CLEANUP_CRON_PATTERN,
  },
});
const heartbeat = heartbeatManager.start();
const shutdownService = createShutdownService({
  registry: liveRegistry,
  heartbeat,
  server: app,
  exitProcess: (code) => process.exit(code),
  reconnectAfterMs: SERVER_RESTART_RECONNECT_AFTER_MS,
  closeCode: SERVER_RESTART_CLOSE_CODE,
});

function handleShutdownSignal() {
  void shutdownService.handleSigterm().catch((error: unknown) => {
    console.error("server_shutdown_failed", error);
    process.exit(1);
  });
}

process.on("SIGTERM", handleShutdownSignal);
process.on("SIGINT", handleShutdownSignal);

app.listen({
  hostname: config.server.host,
  port: config.server.port,
});

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
