import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { errorHandler } from "./plugins/error-handler";
import { requestId } from "./plugins/request-id";
import { createRoomRoutes } from "./modules/room/routes";
import type { RoomService } from "./modules/room";
import {
  createWebSocketRoutes,
  type WebSocketRoutesDeps,
} from "./modules/websocket";
import {
  createDisconnectCleanupCron,
  type DisconnectCleanupService,
} from "./modules/disconnect-cleanup";

export interface AppDeps {
  roomService: RoomService;
  websocket: WebSocketRoutesDeps;
  disconnectCleanup?: {
    cleanupService: DisconnectCleanupService;
    pattern: string;
  };
}

export function createApp({
  roomService,
  websocket,
  disconnectCleanup,
}: AppDeps) {
  const app = new Elysia()
    .use(
      openapi({
        documentation: {
          info: {
            title: "Splendor API",
            version: "1.0.0",
          },
        },
      }),
    )
    .use(requestId)
    .use(errorHandler)
    .get("/health", () => ({ status: "ok" }))
    .use(createRoomRoutes({ roomService }))
    .use(createWebSocketRoutes(websocket));

  return disconnectCleanup
    ? app.use(createDisconnectCleanupCron(disconnectCleanup))
    : app;
}
