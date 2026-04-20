import type { CanonicalState, Command } from "tabletop-engine";
import { AppError } from "../errors";
import type {
  CreateGameSessionFromRoomInput,
  CreateGameSessionServiceDeps,
  GameCommandResult,
  GameEndedResult,
  GamePlayerView,
  GameSessionPlayerSnapshot,
  GameStartedResult,
  MarkDisconnectedInput,
  SubmitGameCommandInput,
} from "./model";

export interface GameSessionService {
  createGameSessionFromRoom(
    input: CreateGameSessionFromRoomInput,
  ): Promise<GameStartedResult>;
  submitCommand(input: SubmitGameCommandInput): Promise<GameCommandResult>;
  markDisconnected(
    input: MarkDisconnectedInput,
  ): Promise<GameEndedResult | null>;
}

function createPlayerId(index: number) {
  return `player-${index + 1}`;
}

function toEngineCommand(command: unknown, actorId: string): Command {
  if (typeof command !== "object" || command === null) {
    throw new AppError(
      "invalid_game_command",
      400,
      "Command must be an object",
    );
  }

  const type = "type" in command ? command.type : undefined;
  const input = "input" in command ? command.input : {};
  if (typeof type !== "string" || type.length === 0) {
    throw new AppError("invalid_game_command", 400, "Command type is required");
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new AppError(
      "invalid_game_command",
      400,
      "Command input must be an object",
    );
  }

  return {
    type,
    actorId,
    input: input as Record<string, unknown>,
  };
}

export function createGameSessionService<
  TState extends CanonicalState<object>,
>({
  store,
  gameExecutor,
  rngSeedGenerator,
  clock,
}: CreateGameSessionServiceDeps<TState>): GameSessionService {
  function createPlayerViews(
    state: TState,
    players: GameSessionPlayerSnapshot[],
  ): GamePlayerView[] {
    return players.map((player) => ({
      playerSessionId: player.playerSessionId,
      playerId: player.playerId,
      view: gameExecutor.getView(state, {
        kind: "player",
        playerId: player.playerId,
      }),
    }));
  }

  return {
    async createGameSessionFromRoom({
      roomId,
      requestingPlayerSessionId,
    }): Promise<GameStartedResult<TState>> {
      const room = await store.loadRoomForGameStart(roomId);
      if (!room) {
        throw new AppError("room_not_found", 404, "Room not found");
      }
      if (room.hostPlayerSessionId !== requestingPlayerSessionId) {
        throw new AppError(
          "room_host_required",
          403,
          "Only the host can start the game",
        );
      }

      const players = [...room.players]
        .sort((left, right) => left.seatIndex - right.seatIndex)
        .map((player, index) => ({
          playerSessionId: player.playerSessionId,
          playerId: createPlayerId(index),
          seatIndex: player.seatIndex,
          displayName: player.displayName,
        }));
      const canonicalState = gameExecutor.createInitialState(
        { playerIds: players.map((player) => player.playerId) },
        rngSeedGenerator(),
      );
      const gameSession = await store.createGameSession({
        canonicalState,
        players,
      });

      await store.deleteRoom(roomId);

      return {
        gameSessionId: gameSession.id,
        canonicalState: gameSession.canonicalState,
        stateVersion: gameSession.stateVersion,
        players: gameSession.players,
        playerViews: createPlayerViews(
          gameSession.canonicalState,
          gameSession.players,
        ),
      };
    },

    async submitCommand({
      gameSessionId,
      playerSessionId,
      command,
    }): Promise<GameCommandResult> {
      const gameSession = await store.loadGameSession(gameSessionId);
      if (!gameSession) {
        throw new AppError("game_not_found", 404, "Game session not found");
      }

      const player = gameSession.players.find(
        (candidate) => candidate.playerSessionId === playerSessionId,
      );
      if (!player) {
        throw new AppError(
          "game_player_not_found",
          403,
          "Player is not seated in this game",
        );
      }

      const result = gameExecutor.executeCommand(
        gameSession.canonicalState,
        toEngineCommand(command, player.playerId),
      );
      if (!result.ok) {
        return {
          accepted: false,
          stateVersion: gameSession.stateVersion,
          reason: result.reason,
          metadata: result.metadata,
          events: result.events,
        };
      }

      const persisted = await store.persistAcceptedCommandResult({
        gameSessionId,
        canonicalState: result.state,
        stateVersion: gameSession.stateVersion + 1,
      });

      return {
        accepted: true,
        stateVersion: persisted.stateVersion,
        events: result.events,
        playerViews: createPlayerViews(
          persisted.canonicalState,
          persisted.players,
        ),
      };
    },

    async markDisconnected({
      gameSessionId,
      playerSessionId,
    }): Promise<GameEndedResult | null> {
      const gameSession = await store.markPlayerDisconnected({
        gameSessionId,
        playerSessionId,
        disconnectedAt: clock.now(),
      });
      if (!gameSession) {
        return null;
      }

      await store.deleteGameSession(gameSessionId);

      return {
        gameSessionId,
        result: {
          reason: "invalidated",
          message: "A seated player disconnected",
        },
      };
    },
  };
}
