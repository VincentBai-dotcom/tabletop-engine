import { expect, test } from "bun:test";
import { GameDefinitionBuilder } from "../src/game-definition";
import {
  hidden,
  OwnedByPlayer,
  State,
  field,
  visibleToSelf,
  viewSchema,
} from "../src/state-facade/metadata";
import { t } from "../src/schema";
import type { CommandDefinition } from "../src/types/command";
import type { Viewer } from "../src/types/visibility";
import { describeGameProtocol } from "../src/index";

const gainScorePayload = t.object({
  amount: t.number(),
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

class GainScoreCommand implements CommandDefinition<
  ProtocolRootState,
  typeof gainScorePayload.static
> {
  readonly commandId = "gain_score";
  readonly payloadSchema = gainScorePayload;

  validate() {
    return { ok: true as const };
  }

  execute() {}
}

test("describeGameProtocol returns command payload schemas", () => {
  const game = new GameDefinitionBuilder<{
    players: Record<string, { id: string; hand: number[] }>;
  }>("protocol-game")
    .initialState(() => ({
      players: {
        p1: { id: "p1", hand: [1, 2] },
      },
    }))
    .rootState(PlainProtocolRootState)
    .commands([new GainScoreCommand()])
    .build();

  const protocol = describeGameProtocol(game);

  expect(protocol.name).toBe("protocol-game");
  expect(protocol.commands.gain_score?.payloadSchema).toBe(gainScorePayload);
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
    .commands([new GainScoreCommand()])
    .build();

  const protocol = describeGameProtocol(game);

  expect(protocol.customViews.SchemaProtocolDeckState).toBe(
    customDeckViewSchema,
  );
  expect(protocol.viewSchema.properties.game.properties.deck).toEqual(
    customDeckViewSchema.schema,
  );
});

test("describeGameProtocol rejects commands without payloadSchema", () => {
  const missingPayloadCommand = {
    commandId: "missing_payload",
    validate: () => ({ ok: true as const }),
    execute: () => {},
  } as unknown as CommandDefinition<ProtocolRootState>;

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
    .commands([missingPayloadCommand])
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "command_payload_schema_required:missing_payload",
  );
});

test("describeGameProtocol rejects custom view methods without view schema", () => {
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
    .commands([new GainScoreCommand()])
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "custom_view_schema_required:ProtocolDeckState",
  );
});

test("describeGameProtocol rejects view schemas without projectCustomView", () => {
  const game = new GameDefinitionBuilder<{
    child: { value: number };
  }>("orphan-view-schema-game")
    .initialState(() => ({
      child: { value: 1 },
    }))
    .rootState(OrphanViewSchemaRootState)
    .commands([new GainScoreCommand()])
    .build();

  expect(() => describeGameProtocol(game)).toThrow(
    "custom_view_schema_requires_project_custom_view:OrphanViewSchemaState",
  );
});
