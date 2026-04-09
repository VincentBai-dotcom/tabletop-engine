import { expect, test } from "bun:test";
import { GameDefinitionBuilder } from "../src/game-definition";
import {
  createCommandFactory,
  generateAsyncApi,
  describeGameProtocol,
} from "../src/index";
import {
  hidden,
  OwnedByPlayer,
  State,
  field,
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
class AsyncApiPlayerState {
  @field(t.string())
  id = "";

  @hidden()
  @field(t.array(t.number()))
  hand: number[] = [];
}

@State()
class AsyncApiDeckState {
  @hidden()
  @field(t.array(t.number()))
  cards: number[] = [];

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
  players: Record<string, AsyncApiPlayerState> = {};

  @field(t.state(() => AsyncApiDeckState))
  deck!: AsyncApiDeckState;
}

@State()
class MissingViewSchemaDeckState {
  @hidden()
  @field(t.array(t.number()))
  cards: number[] = [];

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
  players: Record<string, AsyncApiPlayerState> = {};

  @field(t.state(() => MissingViewSchemaDeckState))
  deck!: MissingViewSchemaDeckState;
}

const defineAsyncApiCommand = createCommandFactory<AsyncApiRootState>();
const defineMissingViewSchemaCommand =
  createCommandFactory<MissingViewSchemaRootState>();

test("generateAsyncApi emits the default hosted channels and schemas", () => {
  const gainScoreCommand = defineAsyncApiCommand({
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

  const game = new GameDefinitionBuilder("asyncapi-game")
    .rootState(AsyncApiRootState)
    .initialStage(createSelfLoopingTurnStage([gainScoreCommand]))
    .build();

  const protocol = describeGameProtocol(game);
  const document = generateAsyncApi(game);

  expect(document.asyncapi).toBe("2.6.0");
  expect(document.info.title).toBe("asyncapi-game");
  expect(document.info.version).toBe("1.0.0");
  expect(document.channels["command.submit"]!.subscribe!.message.$ref).toBe(
    "#/components/messages/SubmitCommand",
  );
  expect(document.channels["command.discover"]!.subscribe!.message.$ref).toBe(
    "#/components/messages/DiscoverCommand",
  );
  expect(document.channels["command.discovered"]!.publish!.message.$ref).toBe(
    "#/components/messages/DiscoveryResult",
  );
  expect(
    document.channels["command.discovery_rejected"]!.publish!.message.$ref,
  ).toBe("#/components/messages/DiscoveryRejected");
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
  expect(submitVariants[0]!.required).toEqual(["type", "actorId", "input"]);
  expect(submitVariants[0]!.properties.actorId.type).toBe("string");
  expect(submitVariants[0]!.properties.input).toEqual(
    gainScoreCommandSchema.schema,
  );
  const discoverPayload = document.components.messages.DiscoverCommand!.payload;
  const discoverVariants = discoverPayload.anyOf ?? [discoverPayload];

  expect(discoverVariants).toHaveLength(1);
  expect(discoverVariants[0]!.properties.type.const).toBe("gain_score");
  expect(discoverVariants[0]!.required).toEqual(["type", "actorId", "input"]);
  expect(discoverVariants[0]!.properties.actorId.type).toBe("string");
  expect(discoverVariants[0]!.properties.requestId.type).toBe("string");
  expect(discoverVariants[0]!.properties.input.type).toBe("object");
  expect(
    discoverVariants[0]!.properties.input.properties.selectedAmount.type,
  ).toBe("number");
  const discoveryResultPayload =
    document.components.messages.DiscoveryResult!.payload;
  const discoveryResultVariants = discoveryResultPayload.anyOf ?? [
    discoveryResultPayload,
  ];
  expect(discoveryResultVariants).toHaveLength(1);
  expect(discoveryResultVariants[0]!.properties.type.const).toBe("gain_score");
  expect(discoveryResultVariants[0]!.required).toEqual([
    "type",
    "actorId",
    "result",
  ]);
  expect(discoveryResultVariants[0]!.properties.actorId.type).toBe("string");
  expect(discoveryResultVariants[0]!.properties.requestId.type).toBe("string");
  expect(discoveryResultVariants[0]!.properties.result.anyOf).toHaveLength(2);
  expect(document.components.schemas.DiscoveryResult).toBeDefined();
  expect(document.components.schemas.DiscoveryRejected).toBeDefined();
  expect(document.components.schemas.GainScoreDiscovery).toBeDefined();
  expect(document.components.schemas.GainScoreDiscoveryResult).toBeDefined();
  expect(document.components.schemas.GainScoreDiscoveryRejected).toBeDefined();
  expect(document.components.schemas.VisibleState).toEqual(protocol.viewSchema);
  expect(document.components.schemas.MatchView!.properties.view).toEqual(
    protocol.viewSchema,
  );
});

test("generateAsyncApi propagates protocol schema validation failures", () => {
  const gainScoreCommand = defineMissingViewSchemaCommand({
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

  const game = new GameDefinitionBuilder("invalid-asyncapi-game")
    .rootState(MissingViewSchemaRootState)
    .initialStage(createSelfLoopingTurnStage([gainScoreCommand]))
    .build();

  expect(() => generateAsyncApi(game)).toThrow(
    "custom_view_schema_required:MissingViewSchemaDeckState",
  );
});
