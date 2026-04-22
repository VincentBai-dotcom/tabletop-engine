import { Elysia, t } from "elysia";
import type { GameSessionService } from "../game-session";
import type { LivePresenceService } from "../live-presence";
import type { RoomService } from "../room";
import type { PlayerSessionService } from "../player-session";
import { createLiveMessageHandler } from "./actions";
import type { HeartbeatManager } from "./heartbeat";
import type {
  LiveClientMessage,
  LiveConnection,
  LiveConnectionRegistry,
  LiveServerMessage,
} from "./model";

export interface WebSocketRoutesDeps {
  registry: LiveConnectionRegistry;
  gameSessionService?: GameSessionService;
  roomService: RoomService;
  livePresenceService?: LivePresenceService;
  heartbeatManager?: HeartbeatManager;
  playerSessionService: PlayerSessionService;
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

function toLiveConnection(ws: {
  id: string;
  send(payload: unknown): unknown;
  ping?(): unknown;
  terminate?(): void;
  close?(code?: number, reason?: string): void;
}) {
  return {
    id: ws.id,
    send(payload: LiveServerMessage) {
      ws.send(payload);
    },
    ping() {
      ws.ping?.();
    },
    terminate() {
      ws.terminate?.();
    },
    close(code, reason) {
      ws.close?.(code, reason);
    },
  } satisfies LiveConnection;
}

export async function handleLiveConnectionClosed({
  registry,
  livePresenceService,
  connectionId,
}: {
  registry: LiveConnectionRegistry;
  livePresenceService?: LivePresenceService;
  connectionId: string;
}) {
  const removed = registry.removeConnection(connectionId);
  if (!removed || !livePresenceService) {
    return;
  }

  await livePresenceService.handleClosedSubscription(removed);
}

export function createWebSocketRoutes({
  registry,
  gameSessionService,
  roomService,
  livePresenceService,
  heartbeatManager,
  playerSessionService,
}: WebSocketRoutesDeps) {
  const handler = createLiveMessageHandler({
    registry,
    roomService,
    gameSessionService,
    livePresenceService,
  });

  return new Elysia().ws("/live", {
    query: t.Object({
      playerSessionToken: t.String({ minLength: 1 }),
    }),
    body: liveMessageSchema,
    async open(ws) {
      const session = await playerSessionService.resolveOrCreatePlayerSession({
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
    pong(ws) {
      heartbeatManager?.markPong(ws.id);
    },
    close(ws) {
      void handleLiveConnectionClosed({
        registry,
        livePresenceService,
        connectionId: ws.id,
      }).catch((error: unknown) => {
        console.error("live_connection_close_cleanup_failed", error);
      });
    },
  });
}
