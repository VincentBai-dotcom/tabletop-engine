import { expect, test } from "bun:test";
import { GameDefinitionBuilder } from "../src/game-definition";
import { createCommandFactory, describeGameProtocol } from "../src/index";
import {
  hidden,
  OwnedByPlayer,
  State,
  field,
  visibleToSelf,
  viewSchema,
} from "../src/state-facade/metadata";
import { t } from "../src/schema";
import type { Viewer } from "../src/types/visibility";
import { createSelfLoopingTurnStage } from "./helpers/stages";

const gainScoreCommandSchema = t.object({
  amount: t.number(),
});
const gainScoreDiscoverySchema = t.object({
  selectedAmount: t.optional(t.number()),
});
const customDeckViewSchema = t.object({
  count: t.number(),
});

@OwnedByPlayer()
@State()
class ProtocolPlayerState {
  @field(t.string())
  id!: string;

  @visibleToSelf()
  @field(t.array(t.number()))
  hand!: number[];
}

@State()
class ProtocolDeckState {
  @hidden()
  @field(t.array(t.number()))
  cards!: number[];

  projectCustomView(viewer: Viewer) {
    void viewer;
    return {
      count: this.cards.length,
    };
  }
}

@State()
class SchemaProtocolDeckState {
  @hidden()
  @field(t.array(t.number()))
  cards!: number[];

  @viewSchema(customDeckViewSchema)
  projectCustomView(viewer: Viewer) {
    void viewer;
    return {
      count: this.cards.length,
    };
  }
}

@State()
class PlainProtocolRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => ProtocolPlayerState),
    ),
  )
  players!: Record<string, ProtocolPlayerState>;
}

@State()
class ProtocolRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => ProtocolPlayerState),
    ),
  )
  players!: Record<string, ProtocolPlayerState>;

  @field(t.state(() => ProtocolDeckState))
  deck!: ProtocolDeckState;
}

@State()
class SchemaProtocolRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => ProtocolPlayerState),
    ),
  )
  players!: Record<string, ProtocolPlayerState>;

  @field(t.state(() => SchemaProtocolDeckState))
  deck!: SchemaProtocolDeckState;
}

@State()
class OrphanViewSchemaState {
  @field(t.number())
  value!: number;

  @viewSchema(t.object({ count: t.number() }))
  describe(): number {
    return this.value;
  }
}

@State()
class OrphanViewSchemaRootState {
  @field(t.state(() => OrphanViewSchemaState))
  child!: OrphanViewSchemaState;
}

const defineProtocolCommand = createCommandFactory<ProtocolRootState>();
const definePlainProtocolCommand =
  createCommandFactory<PlainProtocolRootState>();
const defineOrphanViewSchemaCommand =
  createCommandFactory<OrphanViewSchemaRootState>();

test("describeGameProtocol returns command payload schemas", () => {
  const gainScoreCommand = definePlainProtocolCommand({
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

  const game = new GameDefinitionBuilder<{
    players: Record<string, { id: string; hand: number[] }>;
  }>("protocol-game")
    .initialState(() => ({
      players: {
        p1: { id: "p1", hand: [1, 2] },
      },
    }))
    .rootState(PlainProtocolRootState)
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

  expect(playersSchema.type).toBe("object");
  expect(playerSchema.type).toBe("object");
  expect(playerSchema.properties.id.type).toBe("string");
  expect(playerSchema.properties.hand.anyOf).toHaveLength(2);
});

test("describeGameProtocol includes custom view schemas when provided", () => {
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

  const game = new GameDefinitionBuilder<{
    players: Record<string, { id: string; hand: number[] }>;
    deck: { cards: number[] };
  }>("protocol-view-schema-game")
    .initialState(() => ({
      players: {
        p1: { id: "p1", hand: [1, 2] },
      },
      deck: { cards: [1, 2, 3] },
    }))
    .rootState(SchemaProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([gainScoreCommand]))
    .build();

  const protocol = describeGameProtocol(game);

  expect(protocol.customViews.SchemaProtocolDeckState).toBe(
    customDeckViewSchema,
  );
  expect(protocol.viewSchema.properties.game.properties.deck).toEqual(
    customDeckViewSchema.schema,
  );
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

  const game = new GameDefinitionBuilder<{
    players: Record<string, { id: string; hand: number[] }>;
    deck: { cards: number[] };
  }>("invalid-protocol-game")
    .initialState(() => ({
      players: {
        p1: { id: "p1", hand: [1, 2] },
      },
      deck: { cards: [1, 2, 3] },
    }))
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

  const game = new GameDefinitionBuilder<{
    players: Record<string, { id: string; hand: number[] }>;
  }>("invalid-discovery-protocol-game")
    .initialState(() => ({
      players: {
        p1: { id: "p1", hand: [1, 2] },
      },
    }))
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

  const game = new GameDefinitionBuilder<{
    players: Record<string, { id: string; hand: number[] }>;
  }>("orphan-discovery-draft-protocol-game")
    .initialState(() => ({
      players: {
        p1: { id: "p1", hand: [1, 2] },
      },
    }))
    .rootState(PlainProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([orphanDraftCommand]))
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "command_discovery_handler_required:orphan_draft",
  );
});

test("describeGameProtocol rejects custom view methods without view schema", () => {
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

  const game = new GameDefinitionBuilder<{
    players: Record<string, { id: string; hand: number[] }>;
    deck: { cards: number[] };
  }>("missing-view-schema-game")
    .initialState(() => ({
      players: {
        p1: { id: "p1", hand: [1, 2] },
      },
      deck: { cards: [1, 2, 3] },
    }))
    .rootState(ProtocolRootState)
    .initialStage(createSelfLoopingTurnStage([gainScoreCommand]))
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "custom_view_schema_required:ProtocolDeckState",
  );
});

test("describeGameProtocol rejects view schemas without projectCustomView", () => {
  const gainScoreCommand = defineOrphanViewSchemaCommand({
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

  const game = new GameDefinitionBuilder<{
    child: { value: number };
  }>("orphan-view-schema-game")
    .initialState(() => ({
      child: { value: 1 },
    }))
    .rootState(OrphanViewSchemaRootState)
    .initialStage(createSelfLoopingTurnStage([gainScoreCommand]))
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "custom_view_schema_requires_project_custom_view:OrphanViewSchemaState",
  );
});
