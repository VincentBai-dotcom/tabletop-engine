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

export interface AppDeps {
  roomService: RoomService;
  websocket: WebSocketRoutesDeps;
}

export function createApp({ roomService, websocket }: AppDeps) {
  return new Elysia()
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
}
