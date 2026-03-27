import { expect, test } from "bun:test";
import {
  getStateMetadata,
  scalar,
  state,
  State,
} from "../src/state-facade/metadata";
import { compileStateFacadeDefinition } from "../src/state-facade/compile";
import { hydrateStateFacade } from "../src/state-facade/hydrate";

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

test("mutable state facades allow mutation through state methods but reject direct field writes", () => {
  const compiled = compileStateFacadeDefinition(PlayerState);
  const backing = {
    health: 10,
    hand: {
      size: 3,
    },
  };
  const facade = hydrateStateFacade<PlayerState>(compiled, backing);

  facade.dealDamage(2);

  expect(backing.health).toBe(8);
  expect(() => {
    facade.health = 1;
  }).toThrow("direct_state_mutation_not_allowed:health");
  expect(backing.health).toBe(8);
});
