import { systemClock } from "./lib/clock";
import { configService } from "./modules/config";
import { db } from "./modules/db";
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
const sessionService = createSessionService({
  store: createPlayerSessionStore(db),
  clock: systemClock,
});
const liveRegistry = createLiveConnectionRegistry();
const liveNotifier = createLiveNotifier(liveRegistry);
const roomService = createRoomService({
  store: createRoomStore(db),
  resolveOrCreatePlayerSession: (input) =>
    sessionService.resolveOrCreatePlayerSession(input),
  notifier: liveNotifier,
});

const app = createApp({
  roomService,
  websocket: {
    registry: liveRegistry,
    roomService,
    sessionService,
  },
}).listen({
  hostname: config.server.host,
  port: config.server.port,
});

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
