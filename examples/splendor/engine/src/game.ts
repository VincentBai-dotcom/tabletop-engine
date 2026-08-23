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

  return (
    new GameDefinitionBuilder("splendor")
      .state(SplendorRootState)
      .events(splendorEvents)
      // The roster is the authoritative `players` from the init contract, not a
      // client-supplied setup field; Splendor needs no other setup config.
      .setup(({ game, rng, players }) => {
        if (players.length < 2 || players.length > 4) {
          throw new Error("splendor_requires_2_to_4_players");
        }

        setupSplendorGame(game, rng, players);
      })
      .initialStage(initialStage)
      .build()
  );
}

export function createSplendorExecutor() {
  return createGameExecutor(createSplendorGame());
}

export type SplendorExecutor = ReturnType<typeof createSplendorExecutor>;
export type SplendorState = ReturnType<SplendorExecutor["createInitialState"]>;
