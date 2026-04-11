import {
  createStageFactory,
  field,
  GameDefinitionBuilder,
  State,
  t,
} from "tabletop-engine";

@State()
class FixtureState {
  @field(t.number())
  value = 1;
}

export default function createFixtureGame() {
  const stageFactory = createStageFactory<FixtureState>();

  return new GameDefinitionBuilder("fixture-default")
    .rootState(FixtureState)
    .initialStage(stageFactory("done").automatic().build())
    .build();
}
