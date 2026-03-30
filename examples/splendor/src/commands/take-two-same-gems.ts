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

const takeTwoSameGemsPayloadSchema = t.object({
  color: t.optional(t.string()),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

export type TakeTwoSameGemsPayload = typeof takeTwoSameGemsPayloadSchema.static;

export class TakeTwoSameGemsCommand implements CommandDefinition<
  SplendorGameState,
  TakeTwoSameGemsPayload
> {
  readonly commandId = "take_two_same_gems";
  readonly payloadSchema = takeTwoSameGemsPayloadSchema;

  isAvailable(context: SplendorAvailabilityContext) {
    return guardedAvailability(() => {
      assertAvailableActor(context);
      const game = context.game;
      const bankEntries = Object.entries(game.bank) as Array<[string, number]>;

      return bankEntries.some(
        ([color, count]) => color !== "gold" && count >= 4,
      );
    });
  }

  discover(context: SplendorDiscoveryContext<TakeTwoSameGemsPayload>) {
    const actorId = assertAvailableActor(context);
    const game = context.game;
    const payload = readPayload<Partial<TakeTwoSameGemsPayload>>(
      context.partialCommand,
    );

    if (!payload.color) {
      const bankEntries = Object.entries(game.bank) as Array<[string, number]>;

      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
        options: bankEntries
          .filter(([color, count]) => color !== "gold" && count >= 4)
          .map(([color]) => ({
            id: color,
            value: {
              ...payload,
              color,
            },
            metadata: {
              color,
              amount: 2,
            },
          })),
      };
    }

    const player = game.getPlayer(actorId).clone();
    if (!isGemTokenColor(payload.color)) {
      throw new Error("invalid_color");
    }
    player.tokens.adjustColor(payload.color, 2);
    const requiredReturnCount = player.getRequiredReturnCount();
    const returnDiscovery = createReturnTokenDiscovery(
      payload,
      player.tokens,
      requiredReturnCount,
    );

    return returnDiscovery ?? completeDiscovery(payload);
  }

  validate({
    runtime,
    game,
    commandInput,
  }: SplendorValidationContext<TakeTwoSameGemsPayload>) {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, commandInput.actorId);
      const payload = readPayload<TakeTwoSameGemsPayload>(commandInput);

      if (!payload.color) {
        return { ok: false, reason: "color_required" };
      }

      const color = payload.color;

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
  }: SplendorExecuteContext<TakeTwoSameGemsPayload>) {
    const actorId = commandInput.actorId!;
    const payload = readPayload<TakeTwoSameGemsPayload>(commandInput);
    const color = assertGemTokenColor(payload.color);
    const player = game.getPlayer(actorId);

    game.bank.adjustColor(color, -2);
    player.tokens.adjustColor(color, 2);
    player.returnTokensTo(game.bank, payload.returnTokens);
    emitEvent({
      category: "domain",
      type: "double_gem_taken",
      payload: {
        actorId,
        color,
        returnTokens: payload.returnTokens ?? null,
      },
    });
  }
}

export const takeTwoSameGemsCommand = new TakeTwoSameGemsCommand();
