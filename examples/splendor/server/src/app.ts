import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";
import { errorHandler } from "./plugins/error-handler";
import { requestId } from "./plugins/request-id";
import { config } from "./modules/config";
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
  const serverConfig = config.get();
  const app = new Elysia()
    .use(
      cors({
        origin: serverConfig.web.origin,
        credentials: true,
      }),
    )
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

export type App = ReturnType<typeof createApp>;
export type {
  CreateRoomResult,
  JoinRoomResult,
  RoomPlayerSnapshot,
  RoomSnapshot,
} from "./modules/room";
export type {
  GameEndedPayload,
  LiveClientMessage,
  LiveServerMessage,
} from "./modules/websocket";
