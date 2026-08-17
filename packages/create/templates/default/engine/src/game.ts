import {
  createGameExecutor,
  createStageFactory,
  GameDefinitionBuilder,
  type SingleActivePlayerStageDefinition,
} from "@tableverse-kit/engine";
import { score } from "./commands.ts";
import { events } from "./events.ts";
import { GameState, gameState } from "./state.ts";

const defineStage = createStageFactory<GameState, typeof events>();

const turn: SingleActivePlayerStageDefinition<GameState> = defineStage("turn")
  .singleActivePlayer()
  .activePlayer(() => "p1")
  .commands([score])
  .nextStages(() => ({ turn }))
  .transition(({ nextStages }) => nextStages.turn)
  .build();

export const game = new GameDefinitionBuilder("{{projectName}}")
  .state(gameState)
  .events(events)
  .initialStage(turn)
  .build();

export const executor = createGameExecutor(game);
