import { t } from "tabletop-engine";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import {
  assertGemTokenColor,
  assertAvailableActor,
  assertActivePlayer,
  assertGameActive,
  guardedAvailability,
  guardedValidate,
  isGemTokenColor,
  defineSplendorCommand,
} from "./shared.ts";

const takeTwoSameGemsCommandSchema = t.object({
  color: t.string(),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

export type TakeTwoSameGemsInput = typeof takeTwoSameGemsCommandSchema.static;

const takeTwoSameGemsDiscoverySchema = t.object({
  selectedColor: t.optional(t.string()),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

const takeTwoSameGemsCommand = defineSplendorCommand({
  commandId: "take_two_same_gems",
  commandSchema: takeTwoSameGemsCommandSchema,
})
  .discoverable({
    discoverySchema: takeTwoSameGemsDiscoverySchema,
    discover(context) {
      const actorId = assertAvailableActor(context);
      const game = context.game;
      const draft = context.discovery.input;

      if (!draft?.selectedColor) {
        const bankEntries = Object.entries(game.bank) as Array<
          [string, number]
        >;

        return {
          complete: false as const,
          step: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
          options: bankEntries
            .filter(([color, count]) => color !== "gold" && count >= 4)
            .map(([color]) => ({
              id: color,
              nextInput: {
                ...(draft ?? {}),
                selectedColor: color,
              },
              metadata: {
                color,
                amount: 2,
              },
            })),
        };
      }

      const player = game.getPlayer(actorId).clone();
      if (!isGemTokenColor(draft.selectedColor)) {
        throw new Error("invalid_color");
      }
      player.tokens.adjustColor(draft.selectedColor, 2);
      const requiredReturnCount = player.getRequiredReturnCount();
      const returnDiscovery = createReturnTokenDiscovery(
        draft,
        player.tokens,
        requiredReturnCount,
      );

      return (
        returnDiscovery ??
        completeDiscovery({
          color: draft.selectedColor,
          returnTokens: draft.returnTokens,
        })
      );
    },
  })
  .isAvailable((context) => {
    return guardedAvailability(() => {
      assertAvailableActor(context);
      const game = context.game;
      const bankEntries = Object.entries(game.bank) as Array<[string, number]>;

      return bankEntries.some(
        ([color, count]) => color !== "gold" && count >= 4,
      );
    });
  })
  .validate(({ runtime, game, command }) => {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, command.actorId);
      const input = command.input;

      if (!input) {
        return { ok: false, reason: "color_required" };
      }

      const color = input.color;

      if (!isGemTokenColor(color)) {
        return { ok: false, reason: "invalid_color" };
      }

      if (game.bank[color] < 4) {
        return { ok: false, reason: "not_enough_tokens_for_double_take" };
      }

      const player = game.getPlayer(actorId).clone();
      player.tokens.adjustColor(color, 2);

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
    const color = assertGemTokenColor(input.color);
    const player = game.getPlayer(actorId);

    game.bank.adjustColor(color, -2);
    player.tokens.adjustColor(color, 2);
    player.returnTokensTo(game.bank, input.returnTokens);
    emitEvent({
      category: "domain",
      type: "double_gem_taken",
      payload: {
        actorId,
        color,
        returnTokens: input.returnTokens ?? null,
      },
    });
  })
  .build();

export { takeTwoSameGemsCommand };
