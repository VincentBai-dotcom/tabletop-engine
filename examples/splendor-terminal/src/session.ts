import {
  type CanonicalState,
  createGameExecutor,
  type ExecutionResult,
  type GameExecutor,
  type GameEvent,
} from "tabletop-engine";
import { createSplendorGame } from "splendor-example";
import type {
  SessionActivity,
  SplendorTerminalCommand,
  SplendorTerminalDiscoveryRequest,
  SplendorTerminalDiscoveryResult,
  SplendorVisibleState,
} from "./types.ts";

type TerminalExecutor<TState extends CanonicalState<object>> = {
  createInitialState(options?: { playerIds?: readonly string[] }): TState;
  getView(
    state: TState,
    viewer: Parameters<GameExecutor<object>["getView"]>[1],
  ): ReturnType<GameExecutor<object>["getView"]>;
  listAvailableCommands(
    state: TState,
    options: {
      actorId: string;
    },
  ): string[];
  discoverCommand(
    state: TState,
    discovery: SplendorTerminalDiscoveryRequest,
  ): ReturnType<GameExecutor<object>["discoverCommand"]>;
  executeCommand(
    state: TState,
    command: SplendorTerminalCommand,
  ): ExecutionResult<TState>;
};

export const DEFAULT_PLAYER_IDS = ["you", "bot-1", "bot-2", "bot-3"] as const;

export class SplendorTerminalSession<
  TState extends CanonicalState<object> = CanonicalState<object>,
> {
  private state: TState;
  private activity: SessionActivity = {
    command: null,
    events: [],
    summary: null,
    error: null,
  };

  constructor(
    private readonly gameExecutor: TerminalExecutor<TState>,
    initialState: TState,
    private readonly viewerId: string,
  ) {
    this.state = initialState;
  }

  getVisibleState(): SplendorVisibleState {
    return this.gameExecutor.getView(this.state, {
      kind: "player",
      playerId: this.viewerId,
    }) as SplendorVisibleState;
  }

  getActivity(): SessionActivity {
    return this.activity;
  }

  getActivePlayerId(): string | null {
    const currentStage = this.getVisibleState().progression.currentStage;

    if (currentStage.kind !== "activePlayer") {
      return null;
    }

    return currentStage.activePlayerId;
  }

  isFinished(): boolean {
    return this.getVisibleState().game.winnerIds !== undefined;
  }

  getWinnerIds(): string[] | undefined {
    return this.getVisibleState().game.winnerIds;
  }

  listAvailableCommands(actorId: string): string[] {
    return this.gameExecutor.listAvailableCommands(this.state, { actorId });
  }

  discoverCommand(
    discovery: SplendorTerminalDiscoveryRequest,
  ): SplendorTerminalDiscoveryResult | null {
    return this.gameExecutor.discoverCommand(
      this.state,
      discovery,
    ) as SplendorTerminalDiscoveryResult | null;
  }

  executeCommand(
    command: SplendorTerminalCommand,
    summary: string | null = null,
  ): ExecutionResult<TState> {
    const result = this.gameExecutor.executeCommand(this.state, command);

    if (result.ok) {
      this.state = result.state;
      this.activity = {
        command,
        events: result.events,
        summary,
        error: null,
      };

      return result;
    }

    this.activity = {
      command: null,
      events: [] satisfies GameEvent[],
      summary: null,
      error: result.reason,
    };
    return result;
  }
}

export function createLocalSplendorSession(options?: {
  seed?: string | number;
}) {
  const game = createSplendorGame({
    playerIds: [...DEFAULT_PLAYER_IDS],
    seed: options?.seed ?? "splendor-terminal-seed",
  });
  const gameExecutor = createGameExecutor(game);
  const initialState = gameExecutor.createInitialState({
    playerIds: [...DEFAULT_PLAYER_IDS],
  });

  return new SplendorTerminalSession(gameExecutor, initialState, "you");
}
