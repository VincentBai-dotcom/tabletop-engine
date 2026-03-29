import { expect, test } from "bun:test";
import { GameDefinitionBuilder } from "../src/game-definition";
import {
  hidden,
  OwnedByPlayer,
  State,
  field,
} from "../src/state-facade/metadata";
import { t } from "../src/schema";
import type { CommandDefinition } from "../src/types/command";
import type { Viewer } from "../src/types/visibility";
import { describeGameProtocol } from "../src/index";

const gainScorePayload = t.object({
  amount: t.number(),
});

@OwnedByPlayer()
@State()
class ProtocolPlayerState {
  @field(t.string())
  id!: string;

  @hidden()
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

class GainScoreCommand implements CommandDefinition<
  ProtocolRootState,
  typeof gainScorePayload
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
