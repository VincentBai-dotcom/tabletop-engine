import { t, type CommandDefinition } from "tabletop-engine";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type { SplendorGameState } from "../state.ts";
import {
  assertGemTokenColor,
  assertAvailableActor,
  assertActivePlayer,
  assertGameActive,
  guardedAvailability,
  guardedValidate,
  isGemTokenColor,
  readPayload,
  type SplendorAvailabilityContext,
  type SplendorDiscoveryContext,
  type SplendorExecuteContext,
  type SplendorValidationContext,
} from "./shared.ts";

const takeThreeDistinctGemsPayloadSchema = t.object({
  colors: t.optional(t.array(t.string())),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

export type TakeThreeDistinctGemsPayload =
  typeof takeThreeDistinctGemsPayloadSchema.static;

export class TakeThreeDistinctGemsCommand implements CommandDefinition<
  SplendorGameState,
  TakeThreeDistinctGemsPayload
> {
  readonly commandId = "take_three_distinct_gems";
  readonly payloadSchema = takeThreeDistinctGemsPayloadSchema;

  isAvailable(context: SplendorAvailabilityContext) {
    return guardedAvailability(() => {
      assertAvailableActor(context);
      const game = context.game;
      const bankEntries = Object.entries(game.bank) as Array<[string, number]>;

      return (
        bankEntries.filter(([color, count]) => color !== "gold" && count > 0)
          .length >= 3
      );
    });
  }

  discover(context: SplendorDiscoveryContext<TakeThreeDistinctGemsPayload>) {
    const actorId = assertAvailableActor(context);
    const game = context.game;
    const payload = readPayload<Partial<TakeThreeDistinctGemsPayload>>(
      context.partialCommand,
    );
    const selectedColors = payload.colors ? [...payload.colors] : [];

    if (selectedColors.length < 3) {
      const bankEntries = Object.entries(game.bank) as Array<[string, number]>;

      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
        options: bankEntries
          .filter(
            ([color, count]) =>
              color !== "gold" && count > 0 && !selectedColors.includes(color),
          )
          .map(([color]) => ({
            id: color,
            value: {
              ...payload,
              colors: [...selectedColors, color],
            },
            metadata: {
              color,
              selectedCount: selectedColors.length,
              requiredCount: 3,
            },
          })),
      };
    }

    const player = game.getPlayer(actorId).clone();

    for (const rawColor of selectedColors) {
      const color = assertGemTokenColor(rawColor);
      player.tokens.adjustColor(color, 1);
    }

    const requiredReturnCount = player.getRequiredReturnCount();
    const returnDiscovery = createReturnTokenDiscovery(
      {
        ...payload,
        colors: [...selectedColors],
      },
      player.tokens,
      requiredReturnCount,
    );

    return (
      returnDiscovery ??
      completeDiscovery({
        ...payload,
        colors: [...selectedColors],
      })
    );
  }

  validate({
    runtime,
    game,
    commandInput,
  }: SplendorValidationContext<TakeThreeDistinctGemsPayload>) {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, commandInput.actorId);
      const payload = readPayload<TakeThreeDistinctGemsPayload>(commandInput);

      if (!payload.colors || payload.colors.length !== 3) {
        return { ok: false, reason: "three_colors_required" };
      }

      const colors = payload.colors;

      if (!colors.every((color) => isGemTokenColor(color))) {
        return { ok: false, reason: "invalid_color" };
      }

      const uniqueColors = new Set(colors);

      if (uniqueColors.size !== 3) {
        return { ok: false, reason: "colors_must_be_distinct" };
      }

      const player = game.getPlayer(actorId).clone();

      for (const color of colors) {
        if (game.bank[color] <= 0) {
          return { ok: false, reason: "token_color_unavailable" };
        }

        player.tokens.adjustColor(color, 1);
      }

      if (
        !player.canReturnTokens(
          payload.returnTokens,
          player.getRequiredReturnCount(),
        )
      ) {
        return { ok: false, reason: "invalid_return_tokens" };
      }

      return { ok: true };
    });
  }

  execute({
    game,
    commandInput,
    emitEvent,
  }: SplendorExecuteContext<TakeThreeDistinctGemsPayload>) {
    const actorId = commandInput.actorId!;
    const payload = readPayload<TakeThreeDistinctGemsPayload>(commandInput);
    const colors = payload.colors;

    if (!colors || colors.length !== 3) {
      throw new Error("three_colors_required");
    }

    if (!colors.every((color) => isGemTokenColor(color))) {
      throw new Error("invalid_color");
    }

    const player = game.getPlayer(actorId);

    for (const rawColor of colors) {
      const color = assertGemTokenColor(rawColor);
      game.bank.adjustColor(color, -1);
      player.tokens.adjustColor(color, 1);
    }

    player.returnTokensTo(game.bank, payload.returnTokens);
    emitEvent({
      category: "domain",
      type: "gems_taken",
      payload: {
        actorId,
        colors,
        returnTokens: payload.returnTokens ?? null,
      },
    });
  }
}

export const takeThreeDistinctGemsCommand = new TakeThreeDistinctGemsCommand();
