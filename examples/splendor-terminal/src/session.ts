import {
  createGameExecutor,
  type ExecutionResult,
  type GameExecutor,
  type GameEvent,
} from "tabletop-engine";
import { createSplendorGame, type SplendorGameState } from "splendor-example";
import type {
  SessionActivity,
  SplendorState,
  SplendorTerminalCommand,
  SplendorTerminalDiscoveryRequest,
  SplendorTerminalDiscoveryResult,
} from "./types.ts";

type SplendorGameExecutorApi = Pick<
  GameExecutor<SplendorGameState>,
  | "createInitialState"
  | "listAvailableCommands"
  | "discoverCommand"
  | "executeCommand"
>;

export const DEFAULT_PLAYER_IDS = ["you", "bot-1", "bot-2", "bot-3"] as const;

export class SplendorTerminalSession {
  private state: SplendorState;
  private activity: SessionActivity = {
    command: null,
    events: [],
    summary: null,
    error: null,
  };

  constructor(
    private readonly gameExecutor: SplendorGameExecutorApi,
    initialState: SplendorState,
  ) {
    this.state = initialState;
  }

  getState(): SplendorState {
    return this.state;
  }

  getActivity(): SessionActivity {
    return this.activity;
  }

  getActivePlayerId(): string | null {
    const currentStage = this.state.runtime.progression.currentStage;

    if (currentStage.kind !== "activePlayer") {
      return null;
    }

    return currentStage.activePlayerId;
  }

  isFinished(): boolean {
    return this.state.game.winnerIds !== null;
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
  ): ExecutionResult<SplendorState> {
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
}): SplendorTerminalSession {
  const game = createSplendorGame({
    playerIds: [...DEFAULT_PLAYER_IDS],
    seed: options?.seed ?? "splendor-terminal-seed",
  });
  const gameExecutor = createGameExecutor(game) as SplendorGameExecutorApi;
  const initialState = gameExecutor.createInitialState({
    playerIds: [...DEFAULT_PLAYER_IDS],
  });

  return new SplendorTerminalSession(gameExecutor, initialState);
}
