import type {
  CanonicalState,
  Command,
  ExecutionResult,
  GameEvent,
  Viewer,
} from "tabletop-engine";
import type { Clock } from "../../lib/clock";
import type { RoomSnapshot } from "../room";
import type { GameEndedPayload } from "../websocket";

export interface GameSessionPlayerSnapshot {
  playerSessionId: string;
  playerId: string;
  seatIndex: number;
  displayName: string;
  disconnectedAt: Date | null;
}

export interface GameSessionSnapshot<
  TState extends CanonicalState<object> = CanonicalState<object>,
> {
  id: string;
  canonicalState: TState;
  stateVersion: number;
  players: GameSessionPlayerSnapshot[];
}

export interface CreateGameSessionInput<
  TState extends CanonicalState<object> = CanonicalState<object>,
> {
  canonicalState: TState;
  players: Array<Omit<GameSessionPlayerSnapshot, "disconnectedAt">>;
}

export interface GameSessionStore<
  TState extends CanonicalState<object> = CanonicalState<object>,
> {
  loadRoomForGameStart(roomId: string): Promise<RoomSnapshot | null>;
  createGameSession(
    input: CreateGameSessionInput<TState>,
  ): Promise<GameSessionSnapshot<TState>>;
  loadGameSession(
    gameSessionId: string,
  ): Promise<GameSessionSnapshot<TState> | null>;
  persistAcceptedCommandResult(input: {
    gameSessionId: string;
    canonicalState: TState;
    stateVersion: number;
  }): Promise<GameSessionSnapshot<TState>>;
  deleteRoom(roomId: string): Promise<void>;
  deleteGameSession(gameSessionId: string): Promise<void>;
  markPlayerDisconnected(input: {
    gameSessionId: string;
    playerSessionId: string;
    disconnectedAt: Date;
  }): Promise<GameSessionSnapshot<TState> | null>;
}

export interface HostedGameExecutor<TState extends CanonicalState<object>> {
  createInitialState(
    input: { playerIds: string[] },
    rngSeed: string | number,
  ): TState;
  executeCommand(state: TState, command: Command): ExecutionResult<TState>;
  getView(state: TState, viewer: Viewer): unknown;
}

export interface CreateGameSessionServiceDeps<
  TState extends CanonicalState<object>,
> {
  store: GameSessionStore<TState>;
  gameExecutor: HostedGameExecutor<TState>;
  rngSeedGenerator: () => string | number;
  clock: Clock;
}

export interface CreateGameSessionFromRoomInput {
  roomId: string;
  requestingPlayerSessionId: string;
}

export interface GameStartedResult<
  TState extends CanonicalState<object> = CanonicalState<object>,
> {
  gameSessionId: string;
  canonicalState: TState;
  stateVersion: number;
  players: GameSessionPlayerSnapshot[];
  playerViews: GamePlayerView[];
}

export interface SubmitGameCommandInput {
  gameSessionId: string;
  playerSessionId: string;
  command: unknown;
}

export interface GamePlayerView {
  playerSessionId: string;
  playerId: string;
  view: unknown;
}

export type GameCommandResult =
  | {
      accepted: true;
      stateVersion: number;
      events: GameEvent[];
      playerViews: GamePlayerView[];
    }
  | {
      accepted: false;
      stateVersion: number;
      reason: string;
      metadata?: unknown;
      events: GameEvent[];
    };

export interface MarkDisconnectedInput {
  gameSessionId: string;
  playerSessionId: string;
}

export interface GameEndedResult {
  gameSessionId: string;
  result: GameEndedPayload;
}
