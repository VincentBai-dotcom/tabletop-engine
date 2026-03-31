import { expect, test } from "bun:test";
import { GameDefinitionBuilder } from "../src/game-definition";
import { generateAsyncApi, describeGameProtocol } from "../src/index";
import {
  hidden,
  OwnedByPlayer,
  State,
  field,
  viewSchema,
} from "../src/state-facade/metadata";
import { t } from "../src/schema";
import type { CommandDefinition } from "../src/types/command";
import type { Viewer } from "../src/types/visibility";

const gainScorePayload = t.object({
  amount: t.number(),
});

const customDeckViewSchema = t.object({
  count: t.number(),
});

@OwnedByPlayer()
@State()
class AsyncApiPlayerState {
  @field(t.string())
  id!: string;

  @hidden()
  @field(t.array(t.number()))
  hand!: number[];
}

@State()
class AsyncApiDeckState {
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
class AsyncApiRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => AsyncApiPlayerState),
    ),
  )
  players!: Record<string, AsyncApiPlayerState>;

  @field(t.state(() => AsyncApiDeckState))
  deck!: AsyncApiDeckState;
}

@State()
class MissingViewSchemaDeckState {
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
class MissingViewSchemaRootState {
  @field(
    t.record(
      t.string(),
      t.state(() => AsyncApiPlayerState),
    ),
  )
  players!: Record<string, AsyncApiPlayerState>;

  @field(t.state(() => MissingViewSchemaDeckState))
  deck!: MissingViewSchemaDeckState;
}

class GainScoreCommand implements CommandDefinition<
  AsyncApiRootState,
  typeof gainScorePayload.static
> {
  readonly commandId = "gain_score";
  readonly payloadSchema = gainScorePayload;

  validate() {
    return { ok: true as const };
  }

  execute() {}
}

class MissingViewSchemaCommand implements CommandDefinition<
  MissingViewSchemaRootState,
  typeof gainScorePayload.static
> {
  readonly commandId = "gain_score";
  readonly payloadSchema = gainScorePayload;

  validate() {
    return { ok: true as const };
  }

  execute() {}
}

test("generateAsyncApi emits the default hosted channels and schemas", () => {
  const game = new GameDefinitionBuilder<{
    players: Record<string, { id: string; hand: number[] }>;
    deck: { cards: number[] };
  }>("asyncapi-game")
    .initialState(() => ({
      players: {
        p1: { id: "p1", hand: [1, 2] },
      },
      deck: { cards: [1, 2, 3] },
    }))
    .rootState(AsyncApiRootState)
    .commands([new GainScoreCommand()])
    .build();

  const protocol = describeGameProtocol(game);
  const document = generateAsyncApi(game);

  expect(document.asyncapi).toBe("2.6.0");
  expect(document.info.title).toBe("asyncapi-game");
  expect(document.info.version).toBe("1.0.0");
  expect(document.channels["command.submit"]!.subscribe!.message.$ref).toBe(
    "#/components/messages/SubmitCommand",
  );
  expect(document.channels["match.view"]!.publish!.message.$ref).toBe(
    "#/components/messages/MatchView",
  );
  expect(document.channels["command.rejected"]!.publish!.message.$ref).toBe(
    "#/components/messages/CommandRejected",
  );

  const submitPayload = document.components.messages.SubmitCommand!.payload;
  const submitVariants = submitPayload.anyOf ?? [submitPayload];

  expect(submitVariants).toHaveLength(1);
  expect(submitVariants[0]!.properties.type.const).toBe("gain_score");
  expect(submitVariants[0]!.properties.payload).toEqual(
    gainScorePayload.schema,
  );
  expect(document.components.schemas.VisibleState).toEqual(protocol.viewSchema);
  expect(document.components.schemas.MatchView!.properties.view).toEqual(
    protocol.viewSchema,
  );
});

test("generateAsyncApi propagates protocol schema validation failures", () => {
  const game = new GameDefinitionBuilder<{
    players: Record<string, { id: string; hand: number[] }>;
    deck: { cards: number[] };
  }>("invalid-asyncapi-game")
    .initialState(() => ({
      players: {
        p1: { id: "p1", hand: [1, 2] },
      },
      deck: { cards: [1, 2, 3] },
    }))
    .rootState(MissingViewSchemaRootState)
    .commands([new MissingViewSchemaCommand()])
    .build();

  expect(() => generateAsyncApi(game)).toThrow(
    "custom_view_schema_required:MissingViewSchemaDeckState",
  );
});
