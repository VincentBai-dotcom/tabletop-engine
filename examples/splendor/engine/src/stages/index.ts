import {
  createStageFactory,
  type SingleActivePlayerStageDefinition,
} from "tabletop-engine";
import { createCommands } from "../commands/index.ts";
import type { SplendorGameState } from "../state.ts";
import { createCheckVictoryConditionStage } from "./check-victory-condition.ts";
import { createChooseNobleStage } from "./choose-noble.ts";
import { createGameEndStage } from "./game-end.ts";
import { createPlayerTurnStage } from "./player-turn.ts";
import { createResolveNobleStage } from "./resolve-noble.ts";

export interface SplendorStages {
  initialStage: SingleActivePlayerStageDefinition<SplendorGameState>;
}

export function createSplendorStages(): SplendorStages {
  const defineStage = createStageFactory<SplendorGameState>();
  const commands = createCommands();

  const gameEndStage = createGameEndStage({
    defineStage,
  });

  const chooseNobleStage = createChooseNobleStage({
    defineStage,
    getCheckVictoryConditionStage: () => checkVictoryConditionStage,
  });

  const resolveNobleStage = createResolveNobleStage({
    defineStage,
    getChooseNobleStage: () => chooseNobleStage,
    getCheckVictoryConditionStage: () => checkVictoryConditionStage,
  });

  const checkVictoryConditionStage = createCheckVictoryConditionStage({
    defineStage,
    getGameEndStage: () => gameEndStage,
    getPlayerTurnStage: () => playerTurnStage,
  });

  const playerTurnStage = createPlayerTurnStage({
    defineStage,
    commands,
    getResolveNobleStage: () => resolveNobleStage,
    getCheckVictoryConditionStage: () => checkVictoryConditionStage,
  });

  return {
    initialStage: playerTurnStage,
  };
}
