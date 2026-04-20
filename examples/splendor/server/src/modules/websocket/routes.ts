import { Elysia, t } from "elysia";
import type { RoomService } from "../room";
import type { SessionService } from "../session";
import { createLiveMessageHandler } from "./actions";
import type {
  LiveClientMessage,
  LiveConnection,
  LiveConnectionRegistry,
  LiveServerMessage,
} from "./model";

export interface WebSocketRoutesDeps {
  registry: LiveConnectionRegistry;
  roomService: RoomService;
  sessionService: SessionService;
}

const liveMessageSchema = t.Union([
  t.Object({
    type: t.Literal("subscribe_room"),
    roomId: t.String({ minLength: 1 }),
  }),
  t.Object({
    type: t.Literal("room_set_ready"),
    roomId: t.String({ minLength: 1 }),
    ready: t.Boolean(),
  }),
  t.Object({
    type: t.Literal("room_leave"),
    roomId: t.String({ minLength: 1 }),
  }),
  t.Object({
    type: t.Literal("room_start_game"),
    roomId: t.String({ minLength: 1 }),
  }),
  t.Object({
    type: t.Literal("subscribe_game"),
    gameSessionId: t.String({ minLength: 1 }),
  }),
  t.Object({
    type: t.Literal("game_command"),
    gameSessionId: t.String({ minLength: 1 }),
    command: t.Any(),
  }),
]);

function toLiveConnection(ws: { id: string; send(payload: unknown): unknown }) {
  return {
    id: ws.id,
    send(payload: LiveServerMessage) {
      ws.send(payload);
    },
  } satisfies LiveConnection;
}

export function createWebSocketRoutes({
  registry,
  roomService,
  sessionService,
}: WebSocketRoutesDeps) {
  const handler = createLiveMessageHandler({ registry, roomService });

  return new Elysia().ws("/live", {
    query: t.Object({
      playerSessionToken: t.String({ minLength: 1 }),
    }),
    body: liveMessageSchema,
    async open(ws) {
      const session = await sessionService.resolveOrCreatePlayerSession({
        token: ws.data.query.playerSessionToken,
      });
      const connection = toLiveConnection(ws);
      registry.register(session.playerSessionId, connection);
      connection.send({
        type: "session_resolved",
        playerSessionToken: session.token,
      });
    },
    async message(ws, message: LiveClientMessage) {
      await handler.handleMessage(toLiveConnection(ws), message);
    },
    close(ws) {
      registry.removeConnection(ws.id);
    },
  });
}
