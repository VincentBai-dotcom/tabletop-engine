import { expect, test } from "bun:test";
import { GameDefinitionBuilder } from "../src/game-definition";
import { createCommandFactory, describeGameProtocol } from "../src/index";
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
const gainScoreDiscoverySchema = t.object({
  selectedAmount: t.optional(t.number()),
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
test("describeGameProtocol returns command payload schemas", () => {
  const gainScoreCommand = defineProtocolCommand({
    commandId: "gain_score",
    commandSchema: gainScoreCommandSchema,
  })
    .discoverable({
      discoverySchema: gainScoreDiscoverySchema,
      discover() {
        return {
          complete: true as const,
          input: {
            amount: 1,
          },
        };
      },
    })
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
  expect(protocol.commands.gain_score?.discoverySchema).toBe(
    gainScoreDiscoverySchema,
  );
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

test("describeGameProtocol rejects discovery handlers without draft schemas", () => {
  const missingDraftCommand = definePlainProtocolCommand({
    commandId: "missing_draft",
    commandSchema: gainScoreCommandSchema,
  })
    .discoverable({
      discoverySchema: gainScoreDiscoverySchema,
      discover: () => ({
        complete: true as const,
        input: {
          amount: 1,
        },
      }),
    })
    .validate(() => ({ ok: true as const }))
    .execute(() => {})
    .build();
  delete (
    missingDraftCommand as unknown as {
      discoverySchema?: typeof gainScoreDiscoverySchema;
    }
  ).discoverySchema;

  const game = new GameDefinitionBuilder("invalid-discovery-protocol-game")
    .rootState(PlainProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([missingDraftCommand]))
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "command_discovery_draft_schema_required:missing_draft",
  );
});

test("describeGameProtocol rejects discovery draft schemas without handlers", () => {
  const orphanDraftCommand = definePlainProtocolCommand({
    commandId: "orphan_draft",
    commandSchema: gainScoreCommandSchema,
  })
    .discoverable({
      discoverySchema: gainScoreDiscoverySchema,
      discover: () => ({
        complete: true as const,
        input: {
          amount: 1,
        },
      }),
    })
    .validate(() => ({ ok: true as const }))
    .execute(() => {})
    .build();
  delete (
    orphanDraftCommand as unknown as {
      discover?: () => { complete: true; input: { amount: number } };
    }
  ).discover;

  const game = new GameDefinitionBuilder("orphan-discovery-draft-protocol-game")
    .rootState(PlainProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([orphanDraftCommand]))
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "command_discovery_handler_required:orphan_draft",
  );
});
