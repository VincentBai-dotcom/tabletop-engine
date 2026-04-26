import type {
  DiscoveryRequest,
  DiscoveryResult,
  VisibleState,
} from "splendor-example/client";
import type {
  GameEndedPayload,
  LiveClientMessage,
  LiveServerMessage,
  RoomPlayerSnapshot,
  RoomSnapshot,
} from "splendor-server/client-types";

export type SplendorVisibleState = VisibleState;
export type SplendorDiscoveryRequest = DiscoveryRequest extends infer TRequest
  ? TRequest extends { actorId: string }
    ? Omit<TRequest, "actorId">
    : never
  : never;
export type SplendorDiscoveryResult = DiscoveryResult;
export type SplendorGameCommand = {
  type: string;
  input: Record<string, unknown>;
};

export interface BrowserRoomPlayerSnapshot extends Omit<
  RoomPlayerSnapshot,
  "disconnectedAt"
> {
  disconnectedAt: string | null;
}

export interface BrowserRoomSnapshot extends Omit<RoomSnapshot, "players"> {
  players: BrowserRoomPlayerSnapshot[];
}

export type BrowserLiveServerMessage =
  | { type: "session_resolved"; playerSessionToken: string }
  | { type: "room_snapshot"; room: BrowserRoomSnapshot }
  | { type: "room_updated"; room: BrowserRoomSnapshot }
  | { type: "game_started"; gameSessionId: string }
  | {
      type: "game_available_commands";
      requestId: string;
      gameSessionId: string;
      availableCommands: string[];
    }
  | {
      type: "game_snapshot";
      gameSessionId: string;
      stateVersion: number;
      view: SplendorVisibleState;
      availableCommands: string[];
      events: unknown[];
    }
  | {
      type: "game_discovery_result";
      requestId: string;
      gameSessionId: string;
      result: SplendorDiscoveryResult | null;
    }
  | (
      | {
          type: "game_execution_result";
          requestId: string;
          gameSessionId: string;
          accepted: true;
          stateVersion: number;
          events: unknown[];
        }
      | {
          type: "game_execution_result";
          requestId: string;
          gameSessionId: string;
          accepted: false;
          stateVersion: number;
          reason: string;
          metadata?: unknown;
          events: unknown[];
        }
    )
  | { type: "game_ended"; gameSessionId: string; result: GameEndedPayload }
  | {
      type: "player_disconnected";
      playerSessionId: string;
      graceExpiresAt: string;
    }
  | { type: "player_reconnected"; playerSessionId: string }
  | { type: "server_restarting"; reconnectAfterMs: number }
  | { type: "error"; requestId?: string; code: string; message?: string };

export type BrowserLiveClientMessage = LiveClientMessage;

function normalizeRoomPlayer(
  player: RoomPlayerSnapshot,
): BrowserRoomPlayerSnapshot {
  return {
    ...player,
    disconnectedAt:
      player.disconnectedAt instanceof Date
        ? player.disconnectedAt.toISOString()
        : player.disconnectedAt,
  };
}

export function normalizeRoomSnapshot(room: RoomSnapshot): BrowserRoomSnapshot {
  return {
    ...room,
    players: room.players.map(normalizeRoomPlayer),
  };
}

export function normalizeServerMessage(
  message: unknown,
): BrowserLiveServerMessage {
  const normalized = message as LiveServerMessage;
  switch (normalized.type) {
    case "room_snapshot":
    case "room_updated":
      return {
        ...normalized,
        room: normalizeRoomSnapshot(normalized.room),
      };
    case "game_snapshot":
      return {
        ...normalized,
        view: normalized.view as SplendorVisibleState,
        availableCommands: normalized.availableCommands,
      };
    case "game_discovery_result":
      return {
        ...normalized,
        result:
          normalized.result &&
          typeof normalized.result === "object" &&
          "result" in normalized.result
            ? (normalized.result.result as SplendorDiscoveryResult)
            : null,
      };
    default:
      return normalized;
  }
}
