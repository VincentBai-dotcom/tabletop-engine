import { expect, test } from "bun:test";
import { GameDefinitionBuilder } from "../src/game-definition";
import {
  createCommandFactory,
  generateAsyncApi,
  describeGameProtocol,
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

@State()
class AsyncApiPlayerState {
  @field(t.string())
  id = "";

  @field(t.array(t.number()))
  hand: number[] = [];
}

@State()
class AsyncApiDeckState {
  @field(t.array(t.number()))
  cards: number[] = [];
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

configureVisibility(AsyncApiPlayerState, ({ field }) => ({
  ownedBy: field.id,
  fields: [field.hand.hidden()],
}));

configureVisibility(AsyncApiDeckState, ({ field }) => ({
  fields: [field.cards.hidden()],
}));

const defineAsyncApiCommand = createCommandFactory<AsyncApiRootState>();

test("generateAsyncApi emits step-authored discovery channels and schemas", () => {
  const gainScoreCommand = defineAsyncApiCommand({
    commandId: "gain_score",
    commandSchema: gainScoreCommandSchema,
  })
    .discoverable((step) => [
      step("select_amount")
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
              amount: 1,
            },
            nextStep: "confirm_selection",
          },
        ])
        .build(),
      step("confirm_selection")
        .input(confirmSelectionInputSchema)
        .output(confirmSelectionOutputSchema)
        .resolve(() => ({
          complete: true as const,
          input: {
            amount: 1,
          },
        }))
        .build(),
    ])
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

  expect(discoverVariants).toHaveLength(2);
  expect(discoverVariants[0]!.properties.type.const).toBe("gain_score");
  expect(discoverVariants[0]!.properties.step.const).toBe("select_amount");
  expect(discoverVariants[0]!.required).toEqual([
    "type",
    "actorId",
    "step",
    "input",
  ]);
  expect(discoverVariants[0]!.properties.actorId.type).toBe("string");
  expect(discoverVariants[0]!.properties.requestId.type).toBe("string");
  expect(discoverVariants[0]!.properties.input).toEqual(
    selectAmountInputSchema.schema,
  );
  expect(discoverVariants[1]!.properties.step.const).toBe("confirm_selection");
  expect(discoverVariants[1]!.properties.input).toEqual(
    confirmSelectionInputSchema.schema,
  );

  const discoveryResultPayload =
    document.components.messages.DiscoveryResult!.payload;
  const discoveryResultVariants = discoveryResultPayload.anyOf ?? [
    discoveryResultPayload,
  ];

  expect(discoveryResultVariants).toHaveLength(1);
  expect(discoveryResultVariants[0]!.properties.type.const).toBe("gain_score");
  expect(discoveryResultVariants[0]!.properties.result.anyOf).toHaveLength(3);
  expect(
    discoveryResultVariants[0]!.properties.result.anyOf[0]!.properties.step
      .const,
  ).toBe("select_amount");
  expect(
    discoveryResultVariants[0]!.properties.result.anyOf[0]!.properties.options
      .items.anyOf,
  ).toMatchObject([
    {
      properties: {
        id: {
          type: "string",
        },
        output: selectAmountOutputSchema.schema,
        nextStep: {
          const: "select_amount",
          type: "string",
        },
        nextInput: selectAmountInputSchema.schema,
      },
    },
    {
      properties: {
        id: {
          type: "string",
        },
        output: selectAmountOutputSchema.schema,
        nextStep: {
          const: "confirm_selection",
          type: "string",
        },
        nextInput: confirmSelectionInputSchema.schema,
      },
    },
  ]);
  expect(
    discoveryResultVariants[0]!.properties.result.anyOf[0]!.required,
  ).toEqual(["complete", "step", "options"]);
  expect(
    discoveryResultVariants[0]!.properties.result.anyOf[1]!.required,
  ).toEqual(["complete", "step", "options"]);
  expect(
    discoveryResultVariants[0]!.properties.result.anyOf[2]!.required,
  ).toEqual(["complete", "input"]);
  expect(
    discoveryResultVariants[0]!.properties.result.anyOf[2]!.properties.input,
  ).toEqual(gainScoreCommandSchema.schema);

  expect(document.components.schemas.DiscoveryResult).toBeDefined();
  expect(document.components.schemas.DiscoveryRejected).toBeDefined();
  expect(document.components.schemas.GainScoreDiscoveryRejected).toBeDefined();
  expect(
    document.components.schemas.GainScoreSelectAmountDiscoveryInput,
  ).toBeDefined();
  expect(
    document.components.schemas.GainScoreSelectAmountDiscoveryOutput,
  ).toBeDefined();
  expect(
    document.components.schemas.GainScoreSelectAmountDiscoveryResult,
  ).toBeDefined();
  expect(
    document.components.schemas.GainScoreConfirmSelectionDiscoveryInput,
  ).toBeDefined();
  expect(
    document.components.schemas.GainScoreConfirmSelectionDiscoveryOutput,
  ).toBeDefined();
  expect(
    document.components.schemas.GainScoreConfirmSelectionDiscoveryResult,
  ).toBeDefined();
  expect(document.components.schemas.VisibleState).toEqual(protocol.viewSchema);
  expect(document.components.schemas.MatchView!.properties.view).toEqual(
    protocol.viewSchema,
  );
});
