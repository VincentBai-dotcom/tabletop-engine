import { createStageFactory } from "../../src/stage-factory";
import type { DefinedCommand } from "../../src/types/command";
import type {
  AutomaticStageDefinition,
  SingleActivePlayerStageDefinition,
} from "../../src/types/progression";

export function createTerminalStage<GameState extends object>(
  id = "gameEnd",
): AutomaticStageDefinition<GameState> {
  return createStageFactory<GameState>()(id).automatic().build();
}

export function createSelfLoopingTurnStage<GameState extends object>(
  commands: readonly DefinedCommand<GameState>[],
  options?: {
    id?: string;
    activePlayerId?: string;
  },
): SingleActivePlayerStageDefinition<GameState> {
  return createStageFactory<GameState>()(options?.id ?? "turn")
    .singleActivePlayer()
    .activePlayer(() => options?.activePlayerId ?? "player-1")
    .commands(commands)
    .transition(({ self }) => self)
    .build();
}
