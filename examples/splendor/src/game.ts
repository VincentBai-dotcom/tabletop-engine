import { GameDefinitionBuilder, type GameDefinition } from "tabletop-engine";
import { setupSplendorGame } from "./setup.ts";
import type { SplendorGameState } from "./state.ts";
import { SplendorGameState as SplendorRootState } from "./state.ts";
import { createSplendorStages } from "./stages/index.ts";

export interface CreateSplendorGameOptions {
  playerIds: string[];
  seed?: string | number;
}

export function createSplendorGame(
  options: CreateSplendorGameOptions,
): GameDefinition<SplendorGameState, SplendorGameState> {
  const { playerIds, seed } = options;

  if (playerIds.length < 2 || playerIds.length > 4) {
    throw new Error("splendor_requires_2_to_4_players");
  }

  const { initialStage } = createSplendorStages();

  return new GameDefinitionBuilder<SplendorGameState>("splendor")
    .rootState(SplendorRootState)
    .rngSeed(seed)
    .setup(({ game, rng }) => {
      setupSplendorGame(game, rng, playerIds);
    })
    .initialStage(initialStage)
    .build();
}
