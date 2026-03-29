import { t, type CommandDefinition } from "tabletop-kernel";
import {
  completeDiscovery,
  createNobleDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type { BuyReservedCardPayload, SplendorGameState } from "../state.ts";
import {
  assertAvailableActor,
  assertActivePlayer,
  assertGameActive,
  guardedAvailability,
  guardedValidate,
  readPayload,
  type SplendorAvailabilityContext,
  type SplendorDiscoveryContext,
  type SplendorExecuteContext,
  type SplendorValidationContext,
} from "./shared.ts";

const buyReservedCardPayloadSchema = t.object({
  cardId: t.optional(t.number()),
  chosenNobleId: t.optional(t.number()),
});

export class BuyReservedCardCommand implements CommandDefinition<SplendorGameState> {
  readonly commandId = "buy_reserved_card";
  readonly payloadSchema = buyReservedCardPayloadSchema;

  isAvailable(context: SplendorAvailabilityContext) {
    return guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const game = context.game;
      const player = game.getPlayer(actorId);

      return player.reservedCardIds.some((cardId: number) => {
        const card = game.getCard(cardId);

        return player.getAffordablePayment(card) !== null;
      });
    });
  }

  discover(context: SplendorDiscoveryContext) {
    const actorId = assertAvailableActor(context);
    const game = context.game;
    const payload = readPayload<Partial<BuyReservedCardPayload>>(
      context.partialCommand,
    );
    const player = game.getPlayer(actorId);

    if (!payload.cardId) {
      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectReservedCard,
        options: player.reservedCardIds
          .filter((cardId: number) => {
            const card = game.getCard(cardId);

            return player.getAffordablePayment(card) !== null;
          })
          .map((cardId: number) => ({
            id: String(cardId),
            value: {
              ...payload,
              cardId,
            },
            metadata: {
              cardId,
              source: "reserved",
            },
          })),
      };
    }

    const hypotheticalPlayer = player.clone();
    hypotheticalPlayer.removeReservedCard(payload.cardId);
    hypotheticalPlayer.buyCard(payload.cardId);
    const eligibleNobles = game.getEligibleNobles(hypotheticalPlayer);
    const nobleDiscovery = createNobleDiscovery(payload, eligibleNobles);

    return nobleDiscovery ?? completeDiscovery(payload);
  }

  validate({ runtime, game, commandInput }: SplendorValidationContext) {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, commandInput.actorId);
      const payload = readPayload<BuyReservedCardPayload>(commandInput);
      const player = game.getPlayer(actorId);

      if (!payload.cardId) {
        return { ok: false, reason: "card_required" };
      }

      if (!player.reservedCardIds.includes(payload.cardId)) {
        return { ok: false, reason: "card_not_reserved" };
      }

      const card = game.getCard(payload.cardId);

      if (!player.getAffordablePayment(card)) {
        return { ok: false, reason: "card_not_affordable" };
      }

      const hypotheticalPlayer = player.clone();
      hypotheticalPlayer.removeReservedCard(payload.cardId);
      hypotheticalPlayer.buyCard(payload.cardId);

      const eligibleNobles = game.getEligibleNobles(hypotheticalPlayer);

      if (eligibleNobles.length > 1 && !payload.chosenNobleId) {
        return { ok: false, reason: "chosen_noble_required" };
      }

      if (
        payload.chosenNobleId &&
        !eligibleNobles.some(
          (noble: { id: number }) => noble.id === payload.chosenNobleId,
        )
      ) {
        return { ok: false, reason: "invalid_chosen_noble" };
      }

      return { ok: true };
    });
  }

  execute({ game, commandInput, emitEvent }: SplendorExecuteContext) {
    const actorId = commandInput.actorId!;
    const payload = readPayload<BuyReservedCardPayload>(commandInput);
    const player = game.getPlayer(actorId);
    const card = game.getCard(payload.cardId);
    const payment = player.getAffordablePayment(card);

    if (!payment) {
      throw new Error("card_not_affordable");
    }

    player.tokens.transferTo(game.bank, payment);
    player.removeReservedCard(card.id);
    player.buyCard(card.id);
    emitEvent({
      category: "domain",
      type: "card_purchased",
      payload: {
        actorId,
        source: "reserved",
        cardId: card.id,
        payment,
      },
    });
  }
}

export const buyReservedCardCommand = new BuyReservedCardCommand();
