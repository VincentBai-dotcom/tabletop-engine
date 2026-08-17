import { defineGameState, t } from "@tableverse-kit/engine";

export class GameState {
  count = 0;
}

export const gameState = defineGameState()
  .model({ count: t.number() })
  .stateClass(GameState)
  .build();
