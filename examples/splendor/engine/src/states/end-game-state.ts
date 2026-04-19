import { field, State, t } from "tabletop-engine";

@State()
export class SplendorEndGameState {
  @field(t.string())
  triggeredByPlayerId!: string;

  @field(t.string())
  endsAfterPlayerId!: string;

  static create(
    triggeredByPlayerId: string,
    endsAfterPlayerId: string,
  ): SplendorEndGameState {
    const endGame = new SplendorEndGameState();
    endGame.triggeredByPlayerId = triggeredByPlayerId;
    endGame.endsAfterPlayerId = endsAfterPlayerId;
    return endGame;
  }
}
