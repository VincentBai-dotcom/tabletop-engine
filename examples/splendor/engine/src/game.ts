import {
  createGameExecutor,
  GameDefinitionBuilder,
} from "@tableverse-kit/engine";
import { setupSplendorGame } from "./setup.ts";
import { SplendorGame as SplendorRootState } from "./state.ts";
import { createSplendorStages } from "./stages/index.ts";
import { splendorEvents } from "./events.ts";

export function createSplendorGame() {
  const { initialStage } = createSplendorStages();

  return new GameDefinitionBuilder("splendor")
    .state(SplendorRootState)
    .events(splendorEvents)
    .players({ min: 2, max: 4 })
    .setup(({ game, rng, players }) => {
      setupSplendorGame(game, rng, players);
    })
    .initialStage(initialStage)
    .build();
}

export function createSplendorExecutor() {
  return createGameExecutor(createSplendorGame());
}

export type SplendorExecutor = ReturnType<typeof createSplendorExecutor>;
export type SplendorState = ReturnType<SplendorExecutor["createInitialState"]>;
