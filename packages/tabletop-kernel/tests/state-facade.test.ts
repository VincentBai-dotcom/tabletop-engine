import { expect, test } from "bun:test";
import {
  getStateMetadata,
  scalar,
  state,
  State,
} from "../src/state-facade/metadata";

@State()
class HandState {
  @scalar()
  size!: number;
}

@State()
class PlayerState {
  @scalar()
  health!: number;

  @state(() => HandState)
  hand!: HandState;

  dealDamage(amount: number) {
    this.health -= amount;
  }
}

test("state decorators capture scalar and nested state metadata", () => {
  const handMetadata = getStateMetadata(HandState);
  const playerMetadata = getStateMetadata(PlayerState);
  const handField = playerMetadata.fields.hand;

  expect(handMetadata.type).toBe("state");
  expect(handMetadata.fields.size?.kind).toBe("scalar");
  expect(playerMetadata.type).toBe("state");
  expect(playerMetadata.fields.health?.kind).toBe("scalar");
  expect(handField?.kind).toBe("state");

  if (!handField || handField.kind !== "state") {
    throw new Error("expected nested state field metadata");
  }

  expect(handField.target()).toBe(HandState);
});
