import type {
  AutomaticStageDefinition,
  DefinedCommand,
  SingleActivePlayerStageDefinition,
  StageFactory,
} from "tabletop-engine";
import type { SplendorGameState } from "../state.ts";
import { getLastActingPlayerId } from "./shared.ts";

interface CreatePlayerTurnStageOptions {
  defineStage: StageFactory<SplendorGameState>;
  commands: readonly DefinedCommand<SplendorGameState>[];
  getResolveNobleStage: () => AutomaticStageDefinition<SplendorGameState>;
  getCheckVictoryConditionStage: () => AutomaticStageDefinition<SplendorGameState>;
}

export function createPlayerTurnStage({
  defineStage,
  commands,
  getResolveNobleStage,
  getCheckVictoryConditionStage,
}: CreatePlayerTurnStageOptions): SingleActivePlayerStageDefinition<SplendorGameState> {
  return defineStage("playerTurn")
    .singleActivePlayer()
    .activePlayer(({ game, runtime }) => {
      const previousActorId = runtime.progression.lastActingStage
        ? getLastActingPlayerId(runtime)
        : null;

      return previousActorId
        ? game.getNextPlayerId(previousActorId)
        : game.playerOrder[0]!;
    })
    .commands(commands)
    .nextStages(() => ({
      resolveNobleStage: getResolveNobleStage(),
      checkVictoryConditionStage: getCheckVictoryConditionStage(),
    }))
    .transition(({ command, nextStages }) => {
      return command.type === "buy_face_up_card" ||
        command.type === "buy_reserved_card"
        ? nextStages.resolveNobleStage
        : nextStages.checkVictoryConditionStage;
    })
    .build();
}
