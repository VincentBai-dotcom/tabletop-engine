import { t } from "tabletop-engine";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import {
  assertGemTokenColor,
  guardedAvailability,
  guardedValidate,
  isGemTokenColor,
  defineSplendorCommand,
} from "./shared.ts";

const takeThreeDistinctGemsCommandSchema = t.object({
  colors: t.array(t.string()),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

export type TakeThreeDistinctGemsInput =
  typeof takeThreeDistinctGemsCommandSchema.static;

const takeThreeDistinctGemsDiscoverySchema = t.object({
  selectedColors: t.optional(t.array(t.string())),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

const takeThreeDistinctGemsCommand = defineSplendorCommand({
  commandId: "take_three_distinct_gems",
  commandSchema: takeThreeDistinctGemsCommandSchema,
})
  .discoverable({
    discoverySchema: takeThreeDistinctGemsDiscoverySchema,
    discover(context) {
      const actorId = context.actorId;
      const game = context.game;
      const draft = context.discovery.input;
      const selectedColors = draft?.selectedColors
        ? [...draft.selectedColors]
        : [];

      if (selectedColors.length < 3) {
        const bankEntries = Object.entries(game.bank) as Array<
          [string, number]
        >;

        return {
          complete: false as const,
          step: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
          options: bankEntries
            .filter(
              ([color, count]) =>
                color !== "gold" &&
                count > 0 &&
                !selectedColors.includes(color),
            )
            .map(([color]) => ({
              id: color,
              nextInput: {
                ...(draft ?? {}),
                selectedColors: [...selectedColors, color],
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
          ...draft,
          selectedColors: [...selectedColors],
        },
        player.tokens,
        requiredReturnCount,
      );

      return (
        returnDiscovery ??
        completeDiscovery({
          colors: [...selectedColors],
          returnTokens: draft?.returnTokens,
        })
      );
    },
  })
  .isAvailable((context) => {
    return guardedAvailability(() => {
      const game = context.game;
      const bankEntries = Object.entries(game.bank) as Array<[string, number]>;

      return (
        bankEntries.filter(([color, count]) => color !== "gold" && count > 0)
          .length >= 3
      );
    });
  })
  .validate(({ game, command }) => {
    return guardedValidate(() => {
      const actorId = command.actorId;
      const input = command.input;

      if (input.colors.length !== 3) {
        return { ok: false, reason: "three_colors_required" };
      }

      const colors = input.colors;

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
          input.returnTokens,
          player.getRequiredReturnCount(),
        )
      ) {
        return { ok: false, reason: "invalid_return_tokens" };
      }

      return { ok: true };
    });
  })
  .execute(({ game, command, emitEvent }) => {
    const actorId = command.actorId;
    const input = command.input;
    const colors = input.colors;

    if (!colors.every((color) => isGemTokenColor(color))) {
      throw new Error("invalid_color");
    }

    const player = game.getPlayer(actorId);

    for (const rawColor of colors) {
      const color = assertGemTokenColor(rawColor);
      game.bank.adjustColor(color, -1);
      player.tokens.adjustColor(color, 1);
    }

    player.returnTokensTo(game.bank, input.returnTokens);
    emitEvent({
      category: "domain",
      type: "gems_taken",
      payload: {
        actorId,
        colors,
        returnTokens: input.returnTokens ?? null,
      },
    });
  })
  .build();

export { takeThreeDistinctGemsCommand };
