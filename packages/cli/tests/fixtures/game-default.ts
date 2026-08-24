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

export default function createFixtureGame() {
  const stageFactory = createStageFactory<FixtureState>();

  return new GameDefinitionBuilder("fixture-default")
    .state(FixtureGameState)
    .players({ min: 2, max: 5 })
    .initialStage(stageFactory("done").automatic().build())
    .build();
}
