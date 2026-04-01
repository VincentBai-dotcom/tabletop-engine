import { t } from "tabletop-engine";
import {
  completeDiscovery,
  createNobleDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import {
  assertAvailableActor,
  assertActivePlayer,
  assertGameActive,
  defineSplendorCommand,
  guardedAvailability,
  guardedValidate,
} from "./shared.ts";

const buyReservedCardPayloadSchema = t.object({
  cardId: t.number(),
  chosenNobleId: t.optional(t.number()),
});

export type BuyReservedCardPayload = typeof buyReservedCardPayloadSchema.static;

const buyReservedCardDraftSchema = t.object({
  selectedCardId: t.optional(t.number()),
  chosenNobleId: t.optional(t.number()),
});

const buyReservedCardCommand = defineSplendorCommand({
  commandId: "buy_reserved_card",
  payloadSchema: buyReservedCardPayloadSchema,
  discoveryDraftSchema: buyReservedCardDraftSchema,

  isAvailable(context) {
    return guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const game = context.game;
      const player = game.getPlayer(actorId);

      return player.reservedCardIds.some((cardId: number) => {
        const card = game.getCard(cardId);

        return player.getAffordablePayment(card) !== null;
      });
    });
  },

  discover(context) {
    const actorId = assertAvailableActor(context);
    const game = context.game;
    const draft = context.discoveryInput.draft;
    const player = game.getPlayer(actorId);

    if (!draft?.selectedCardId) {
      return {
        complete: false as const,
        step: SPLENDOR_DISCOVERY_STEPS.selectReservedCard,
        options: player.reservedCardIds
          .filter((cardId: number) => {
            const card = game.getCard(cardId);

            return player.getAffordablePayment(card) !== null;
          })
          .map((cardId: number) => ({
            id: String(cardId),
            nextDraft: {
              ...(draft ?? {}),
              selectedCardId: cardId,
            },
            metadata: {
              cardId,
              source: "reserved",
            },
          })),
      };
    }

    const hypotheticalPlayer = player.clone();
    hypotheticalPlayer.removeReservedCard(draft.selectedCardId);
    hypotheticalPlayer.buyCard(draft.selectedCardId);
    const eligibleNobles = game.getEligibleNobles(hypotheticalPlayer);
    const nobleDiscovery = createNobleDiscovery(draft, eligibleNobles);

    return (
      nobleDiscovery ??
      completeDiscovery({
        cardId: draft.selectedCardId,
        chosenNobleId: draft.chosenNobleId,
      })
    );
  },

  validate({ runtime, game, commandInput }) {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, commandInput.actorId);
      const payload = commandInput.payload;
      const player = game.getPlayer(actorId);

      if (!payload) {
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
  },

  execute({ game, commandInput, emitEvent }) {
    const actorId = commandInput.actorId!;
    const payload = commandInput.payload!;
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
  },
});

export { buyReservedCardCommand };
