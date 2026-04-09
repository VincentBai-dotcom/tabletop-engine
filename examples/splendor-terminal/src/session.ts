import {
  createGameExecutor,
  type ExecutionResult,
  type GameExecutor,
  type GameEvent,
} from "tabletop-engine";
import { createSplendorGame } from "splendor-example";
import type {
  SessionActivity,
  SplendorState,
  SplendorTerminalCommand,
  SplendorTerminalDiscoveryRequest,
  SplendorTerminalDiscoveryResult,
  SplendorVisibleState,
} from "./types.ts";

type SplendorGameExecutorApi = Pick<
  GameExecutor<SplendorState["game"]>,
  | "createInitialState"
  | "getView"
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

  return new SplendorTerminalSession(gameExecutor, initialState, "you");
}
