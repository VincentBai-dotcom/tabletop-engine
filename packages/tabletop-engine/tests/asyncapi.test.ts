import { expect, test } from "bun:test";
import { GameDefinitionBuilder } from "../src/game-definition";
import {
  createCommandFactory,
  describeEngineWebSocketProtocol,
  describeGameProtocol,
  generateAsyncApi,
} from "../src/index";
import {
  configureVisibility,
  field,
  State,
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

test("generateAsyncApi emits hosted engine websocket channels and schemas", () => {
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
    .validate(() => ({ ok: true as const }))
    .execute(() => {})
    .build();

  const game = new GameDefinitionBuilder("asyncapi-game")
    .rootState(AsyncApiRootState)
    .initialStage(createSelfLoopingTurnStage([gainScoreCommand]))
    .build();

  const protocol = describeGameProtocol(game);
  const websocket = describeEngineWebSocketProtocol(game);
  const document = generateAsyncApi(game);

  expect(document.asyncapi).toBe("2.6.0");
  expect(document.info.title).toBe("asyncapi-game");
  expect(
    document.channels["game_list_available_commands"]!.subscribe!.message.$ref,
  ).toBe("#/components/messages/GameListAvailableCommands");
  expect(
    document.channels["game_available_commands"]!.publish!.message.$ref,
  ).toBe("#/components/messages/GameAvailableCommands");
  expect(document.channels["game_discover"]!.subscribe!.message.$ref).toBe(
    "#/components/messages/GameDiscover",
  );
  expect(
    document.channels["game_discovery_result"]!.publish!.message.$ref,
  ).toBe("#/components/messages/GameDiscoveryResult");
  expect(document.channels["game_execute"]!.subscribe!.message.$ref).toBe(
    "#/components/messages/GameExecute",
  );
  expect(
    document.channels["game_execution_result"]!.publish!.message.$ref,
  ).toBe("#/components/messages/GameExecutionResult");
  expect(document.channels["game_snapshot"]!.publish!.message.$ref).toBe(
    "#/components/messages/GameSnapshot",
  );
  expect(document.channels["game_ended"]!.publish!.message.$ref).toBe(
    "#/components/messages/GameEnded",
  );
  expect(document.channels.error!.publish!.message.$ref).toBe(
    "#/components/messages/GameError",
  );

  expect(websocket.messages.execute).toBe("game_execute");

  const executePayload = document.components.messages.GameExecute!.payload;
  expect(executePayload.properties.type.const).toBe("game_execute");
  expect(executePayload.required).toEqual([
    "type",
    "requestId",
    "gameSessionId",
    "command",
  ]);
  const commandVariants =
    "anyOf" in executePayload.properties.command &&
    executePayload.properties.command.anyOf
      ? executePayload.properties.command.anyOf
      : [executePayload.properties.command];
  expect(commandVariants).toHaveLength(1);
  expect(commandVariants[0]!.properties.type.const).toBe("gain_score");
  expect(commandVariants[0]!.properties.input).toEqual(
    gainScoreCommandSchema.schema,
  );

  const discoverPayload = document.components.messages.GameDiscover!.payload;
  expect(discoverPayload.properties.type.const).toBe("game_discover");
  expect(discoverPayload.required).toEqual([
    "type",
    "requestId",
    "gameSessionId",
    "discovery",
  ]);
  const discoveryVariants =
    "anyOf" in discoverPayload.properties.discovery &&
    discoverPayload.properties.discovery.anyOf
      ? discoverPayload.properties.discovery.anyOf
      : [discoverPayload.properties.discovery];
  expect(discoveryVariants).toHaveLength(2);
  expect(discoveryVariants[0]!.properties.type.const).toBe("gain_score");
  expect(discoveryVariants[0]!.properties.step.const).toBe("select_amount");
  expect(discoveryVariants[0]!.properties.input).toEqual(
    selectAmountInputSchema.schema,
  );
  expect(discoveryVariants[1]!.properties.step.const).toBe("confirm_selection");
  expect(discoveryVariants[1]!.properties.input).toEqual(
    confirmSelectionInputSchema.schema,
  );

  const discoveryResultPayload =
    document.components.messages.GameDiscoveryResult!.payload;
  expect(discoveryResultPayload.properties.type.const).toBe(
    "game_discovery_result",
  );
  expect(discoveryResultPayload.properties.requestId.type).toBe("string");
  expect(discoveryResultPayload.properties.result.anyOf).toHaveLength(2);
  expect(discoveryResultPayload.properties.result.anyOf[1]!.type).toBe("null");
  expect(discoveryResultPayload.properties.result.anyOf[0]!.anyOf).toHaveLength(
    3,
  );
  expect(
    discoveryResultPayload.properties.result.anyOf[0]!.anyOf[0]!.properties.type
      .const,
  ).toBe("gain_score");
  expect(
    discoveryResultPayload.properties.result.anyOf[0]!.anyOf[0]!.properties
      .result.properties.step.const,
  ).toBe("select_amount");
  expect(
    discoveryResultPayload.properties.result.anyOf[0]!.anyOf[0]!.properties
      .result.properties.options.items.anyOf,
  ).toMatchObject([
    {
      properties: {
        id: { type: "string" },
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
        id: { type: "string" },
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
    discoveryResultPayload.properties.result.anyOf[0]!.anyOf[2]!.properties
      .result.properties.input,
  ).toEqual(gainScoreCommandSchema.schema);

  const gameSnapshotPayload =
    document.components.messages.GameSnapshot!.payload;
  expect(gameSnapshotPayload.properties.type.const).toBe("game_snapshot");
  expect(gameSnapshotPayload.properties.gameSessionId.type).toBe("string");
  expect(gameSnapshotPayload.properties.view).toEqual(protocol.viewSchema);
  expect(gameSnapshotPayload.properties.availableCommands.type).toBe("array");

  const gameEndedPayload = document.components.messages.GameEnded!.payload;
  expect(gameEndedPayload.properties.type.const).toBe("game_ended");
  expect(
    gameEndedPayload.properties.result.properties.reason.anyOf,
  ).toHaveLength(2);

  const errorPayload = document.components.messages.GameError!.payload;
  expect(errorPayload.properties.type.const).toBe("error");
  expect(errorPayload.properties.code.type).toBe("string");
  expect(errorPayload.properties.requestId.type).toBe("string");
  expect(errorPayload.required).toEqual(["type", "code"]);

  const executionResultPayload =
    document.components.messages.GameExecutionResult!.payload;
  expect(executionResultPayload.anyOf).toHaveLength(2);
  expect(executionResultPayload.anyOf[0]!.properties.accepted.const).toBe(true);
  expect(executionResultPayload.anyOf[1]!.properties.accepted.const).toBe(
    false,
  );

  expect(document.components.schemas.VisibleState).toEqual(protocol.viewSchema);
  expect(document.components.schemas.CommandPayload).toBeDefined();
  expect(document.components.schemas.DiscoveryPayload).toBeDefined();
  expect(document.components.schemas.DiscoveryResult).toBeDefined();
  expect(document.components.schemas.GameExecutionResult).toBeDefined();
  expect(document.components.schemas.GameSnapshot).toBeDefined();
  expect(document.components.schemas.GameEnded).toBeDefined();
  expect(document.components.schemas.GameError).toBeDefined();
});
