import {
  createStageFactory,
  GameDefinitionBuilder,
  type GameDefinition,
} from "tabletop-engine";
import { createCommands } from "./commands/index.ts";
import { createInitialGameState, setupSplendorGame } from "./setup.ts";
import type { SplendorGameState } from "./state.ts";
import { SplendorGameState as SplendorRootState } from "./state.ts";

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

  const defineStage = createStageFactory<SplendorGameState>();
  const commands = createCommands();
  const gameEndStage = defineStage("gameEnd").automatic().build();
  const playerTurnStage = defineStage("playerTurn")
    .singleActivePlayer()
    .activePlayer(({ game, runtime }) => {
      const previousActorId =
        runtime.progression.lastActingStage?.activePlayerId;

      return previousActorId
        ? game.getNextPlayerId(previousActorId)
        : game.playerOrder[0]!;
    })
    .commands(commands)
    .nextStages({
      gameEndStage,
    })
    .transition(({ game, self, nextStages }) => {
      return game.winnerIds ? nextStages.gameEndStage : self;
    })
    .build();

  return new GameDefinitionBuilder<SplendorGameState>("splendor")
    .rootState(SplendorRootState)
    .rngSeed(seed)
    .initialState(() => createInitialGameState(playerIds))
    .setup(({ game, runtime, rng }) => {
      setupSplendorGame(game, runtime, rng, playerIds);
    })
    .initialStage(playerTurnStage)
    .build();
}
