import { createSplendorExecutor, type SplendorState } from "splendor-example";
import { systemClock } from "./lib/clock";
import { createRandomToken } from "./lib/random";
import { configService } from "./modules/config";
import { createDbClient } from "./modules/db";
import {
  createGameSessionService,
  createGameSessionStore,
} from "./modules/game-session";
import { createRoomService, createRoomStore } from "./modules/room";
import {
  createPlayerSessionStore,
  createSessionService,
} from "./modules/session";
import {
  createLiveConnectionRegistry,
  createLiveNotifier,
} from "./modules/websocket";
import { createApp } from "./app";

const config = configService.get();
const { db } = createDbClient(config.database.url);
const sessionService = createSessionService({
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
    sessionService.resolveOrCreatePlayerSession(input),
  notifier: liveNotifier,
  startGameFromRoom: (input) =>
    gameSessionService.createGameSessionFromRoom(input),
});

const app = createApp({
  roomService,
  websocket: {
    registry: liveRegistry,
    gameSessionService,
    roomService,
    sessionService,
  },
}).listen({
  hostname: config.server.host,
  port: config.server.port,
});

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
