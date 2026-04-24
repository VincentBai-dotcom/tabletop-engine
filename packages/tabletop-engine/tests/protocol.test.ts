import { expect, test } from "bun:test";
import { GameDefinitionBuilder } from "../src/game-definition";
import {
  createCommandFactory,
  describeGameProtocol,
  discoveryStep,
} from "../src/index";
import {
  configureVisibility,
  State,
  field,
} from "../src/state-facade/metadata";
import { t } from "../src/schema";
import { createSelfLoopingTurnStage } from "./helpers/stages";

const gainScoreCommandSchema = t.object({
  amount: t.number(),
});
const selectAmountInputSchema = t.object({
  selectedAmount: t.optional(t.number()),
});
const selectAmountOutputSchema = t.object({
  amount: t.number(),
  label: t.string(),
});
const confirmSelectionInputSchema = t.object({
  amount: t.number(),
});
const confirmSelectionOutputSchema = t.object({
  confirmed: t.boolean(),
});
const hiddenViewSchema = t.object({
  count: t.number(),
});

@State()
class ProtocolPlayerState {
  @field(t.string())
  id = "";

  @field(t.array(t.number()))
  hand: number[] = [];
}

@State()
class ProtocolDeckState {
  @field(t.array(t.number()))
  cards: number[] = [];
}

@State()
class PlainProtocolRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => ProtocolPlayerState),
    ),
  )
  players: Record<string, ProtocolPlayerState> = {};
}

@State()
class ProtocolRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => ProtocolPlayerState),
    ),
  )
  players: Record<string, ProtocolPlayerState> = {};

  @field(t.state(() => ProtocolDeckState))
  deck!: ProtocolDeckState;
}

configureVisibility(ProtocolPlayerState, ({ field }) => ({
  ownedBy: field.id,
  fields: [
    field.hand.visibleToSelf({
      schema: hiddenViewSchema,
      derive(hand) {
        return {
          count: hand.length,
        };
      },
    }),
  ],
}));

configureVisibility(ProtocolDeckState, ({ field }) => ({
  fields: [
    field.cards.hidden({
      schema: hiddenViewSchema,
      derive(cards) {
        return {
          count: cards.length,
        };
      },
    }),
  ],
}));

const defineProtocolCommand = createCommandFactory<ProtocolRootState>();
const definePlainProtocolCommand =
  createCommandFactory<PlainProtocolRootState>();

test("describeGameProtocol returns step-authored discovery metadata", () => {
  const gainScoreCommand = defineProtocolCommand({
    commandId: "gain_score",
    commandSchema: gainScoreCommandSchema,
  })
    .discoverable(
      discoveryStep("confirm_selection")
        .input(confirmSelectionInputSchema)
        .output(confirmSelectionOutputSchema)
        .resolve(() => ({
          complete: true as const,
          input: {
            amount: 1,
          },
        }))
        .build(),
      discoveryStep("select_amount")
        .initial()
        .input(selectAmountInputSchema)
        .output(selectAmountOutputSchema)
        .resolve(() => [
          {
            id: "preset_one",
            output: {
              amount: 1,
              label: "One",
            },
            nextInput: {
              selectedAmount: 1,
            },
            nextStep: "confirm_selection",
          },
        ])
        .build(),
    )
    .validate(() => {
      return { ok: true as const };
    })
    .execute(() => {})
    .build();

  const game = new GameDefinitionBuilder("protocol-game")
    .rootState(ProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([gainScoreCommand]))
    .build();

  const protocol = describeGameProtocol(game);

  expect(protocol.name).toBe("protocol-game");
  expect(protocol.commands.gain_score?.commandSchema).toBe(
    gainScoreCommandSchema,
  );
  expect(protocol.commands.gain_score?.discovery?.startStep).toBe(
    "select_amount",
  );
  expect(protocol.commands.gain_score?.discovery?.steps).toHaveLength(2);
  expect(protocol.commands.gain_score?.discovery?.steps[0]?.stepId).toBe(
    "confirm_selection",
  );
  expect(protocol.commands.gain_score?.discovery?.steps[0]?.inputSchema).toBe(
    confirmSelectionInputSchema,
  );
  expect(protocol.commands.gain_score?.discovery?.steps[0]?.outputSchema).toBe(
    confirmSelectionOutputSchema,
  );
  expect(protocol.commands.gain_score?.discovery?.steps[1]?.stepId).toBe(
    "select_amount",
  );
  expect(protocol.commands.gain_score?.discovery?.steps[1]?.inputSchema).toBe(
    selectAmountInputSchema,
  );
  expect(protocol.commands.gain_score?.discovery?.steps[1]?.outputSchema).toBe(
    selectAmountOutputSchema,
  );
  expect(
    "defaultNextStep" in protocol.commands.gain_score!.discovery!.steps[0]!,
  ).toBe(false);
  expect(
    "defaultNextStep" in protocol.commands.gain_score!.discovery!.steps[1]!,
  ).toBe(false);
  expect(protocol.viewSchema.type).toBe("object");
  expect(protocol.viewSchema.properties.game.type).toBe("object");
  expect(protocol.viewSchema.properties.progression.type).toBe("object");

  const playersSchema = protocol.viewSchema.properties.game.properties.players;
  const playerSchema = playersSchema.patternProperties["^(.*)$"];
  const deckSchema = protocol.viewSchema.properties.game.properties.deck;

  expect(playersSchema.type).toBe("object");
  expect(playerSchema.type).toBe("object");
  expect(playerSchema.properties.id.type).toBe("string");
  expect(playerSchema.properties.hand.anyOf).toHaveLength(2);
  expect(playerSchema.properties.hand.anyOf[1]).toMatchObject({
    type: "object",
    properties: {
      __hidden: {
        const: true,
        type: "boolean",
      },
      value: hiddenViewSchema.schema,
    },
    required: ["__hidden", "value"],
  });
  expect(deckSchema).toMatchObject({
    type: "object",
    properties: {
      cards: {
        type: "object",
        properties: {
          __hidden: {
            const: true,
            type: "boolean",
          },
          value: hiddenViewSchema.schema,
        },
        required: ["__hidden", "value"],
      },
    },
  });
});

test("describeGameProtocol rejects commands without commandSchema", () => {
  const missingPayloadCommand = defineProtocolCommand({
    commandId: "missing_payload",
    commandSchema: gainScoreCommandSchema,
  })
    .validate(() => ({ ok: true as const }))
    .execute(() => {})
    .build();
  delete (
    missingPayloadCommand as unknown as {
      commandSchema?: typeof gainScoreCommandSchema;
    }
  ).commandSchema;

  const game = new GameDefinitionBuilder("invalid-protocol-game")
    .rootState(ProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([missingPayloadCommand]))
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "command_payload_schema_required:missing_payload",
  );
});

test("describeGameProtocol rejects discovery commands without discovery steps", () => {
  const missingDiscoveryStepsCommand = definePlainProtocolCommand({
    commandId: "missing_discovery_steps",
    commandSchema: gainScoreCommandSchema,
  })
    .discoverable(
      discoveryStep("select_amount")
        .initial()
        .input(selectAmountInputSchema)
        .output(selectAmountOutputSchema)
        .resolve(() => ({
          complete: true as const,
          input: {
            amount: 1,
          },
        }))
        .build(),
    )
    .validate(() => ({ ok: true as const }))
    .execute(() => {})
    .build();

  delete (
    missingDiscoveryStepsCommand as unknown as {
      discovery?: { steps?: unknown[] };
    }
  ).discovery!.steps;

  const game = new GameDefinitionBuilder("invalid-discovery-protocol-game")
    .rootState(PlainProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([missingDiscoveryStepsCommand]))
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "command_discovery_steps_required:missing_discovery_steps",
  );
});

test("describeGameProtocol rejects discovery commands with empty discovery steps", () => {
  const emptyDiscoveryStepsCommand = definePlainProtocolCommand({
    commandId: "empty_discovery_steps",
    commandSchema: gainScoreCommandSchema,
  })
    .discoverable(
      discoveryStep("select_amount")
        .initial()
        .input(selectAmountInputSchema)
        .output(selectAmountOutputSchema)
        .resolve(() => ({
          complete: true as const,
          input: {
            amount: 1,
          },
        }))
        .build(),
    )
    .validate(() => ({ ok: true as const }))
    .execute(() => {})
    .build();

  (
    emptyDiscoveryStepsCommand as unknown as { discovery: { steps: unknown[] } }
  ).discovery.steps = [];

  const game = new GameDefinitionBuilder("empty-discovery-protocol-game")
    .rootState(PlainProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([emptyDiscoveryStepsCommand]))
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "command_discovery_steps_required:empty_discovery_steps",
  );
});

test("describeGameProtocol rejects malformed discovery step entries", () => {
  const malformedStepCommand = definePlainProtocolCommand({
    commandId: "malformed_discovery_step",
    commandSchema: gainScoreCommandSchema,
  })
    .discoverable(
      discoveryStep("select_amount")
        .initial()
        .input(selectAmountInputSchema)
        .output(selectAmountOutputSchema)
        .resolve(() => ({
          complete: true as const,
          input: {
            amount: 1,
          },
        }))
        .build(),
    )
    .validate(() => ({ ok: true as const }))
    .execute(() => {})
    .build();

  const malformedStepsCommand = malformedStepCommand as unknown as {
    discovery: { steps: unknown[] };
  };

  malformedStepsCommand.discovery.steps[0] = null;
  const nullStepsGame = new GameDefinitionBuilder("null-discovery-step-game")
    .rootState(PlainProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([malformedStepCommand]))
    .build();

  expect(() => describeGameProtocol(nullStepsGame)).toThrow(
    "command_discovery_step_invalid:malformed_discovery_step:0",
  );

  malformedStepsCommand.discovery.steps[0] = {};
  const emptyStepsGame = new GameDefinitionBuilder("empty-discovery-step-game")
    .rootState(PlainProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([malformedStepCommand]))
    .build();

  expect(() => describeGameProtocol(emptyStepsGame)).toThrow(
    "command_discovery_step_missing_step_id:malformed_discovery_step:0",
  );

  malformedStepsCommand.discovery.steps[0] = {
    stepId: "select_amount",
    outputSchema: selectAmountOutputSchema,
    resolve: () => ({
      complete: true as const,
      input: {
        amount: 1,
      },
    }),
  };
  const missingInputSchemaGame = new GameDefinitionBuilder(
    "missing-input-schema-game",
  )
    .rootState(PlainProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([malformedStepCommand]))
    .build();

  expect(() => describeGameProtocol(missingInputSchemaGame)).toThrow(
    "command_discovery_step_missing_input_schema:malformed_discovery_step:0",
  );

  malformedStepsCommand.discovery.steps[0] = {
    stepId: "select_amount",
    inputSchema: selectAmountInputSchema,
    resolve: () => ({
      complete: true as const,
      input: {
        amount: 1,
      },
    }),
  };
  const missingOutputSchemaGame = new GameDefinitionBuilder(
    "missing-output-schema-game",
  )
    .rootState(PlainProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([malformedStepCommand]))
    .build();

  expect(() => describeGameProtocol(missingOutputSchemaGame)).toThrow(
    "command_discovery_step_missing_output_schema:malformed_discovery_step:0",
  );

  malformedStepsCommand.discovery.steps[0] = {
    stepId: "select_amount",
    inputSchema: selectAmountInputSchema,
    outputSchema: selectAmountOutputSchema,
  };
  const missingResolveGame = new GameDefinitionBuilder("missing-resolve-game")
    .rootState(PlainProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([malformedStepCommand]))
    .build();

  expect(() => describeGameProtocol(missingResolveGame)).toThrow(
    "command_discovery_step_missing_resolve:malformed_discovery_step:0",
  );
});
