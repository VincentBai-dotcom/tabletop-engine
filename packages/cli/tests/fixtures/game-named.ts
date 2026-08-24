import {
  createStageFactory,
  GameDefinitionBuilder,
  defineGameState,
  t,
} from "@tableverse-kit/engine";

class FixtureState {
  value = 1;
}

const FixtureGameState = defineGameState()
  .model({
    value: t.number(),
  })
  .stateClass(FixtureState)
  .build();

export function createFixtureGame() {
  const stageFactory = createStageFactory<FixtureState>();

  return new GameDefinitionBuilder("fixture-named")
    .state(FixtureGameState)
    .players({ min: 1, max: 8 })
    .initialStage(stageFactory("done").automatic().build())
    .build();
}
