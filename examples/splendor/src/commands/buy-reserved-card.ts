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

const buyReservedCardCommandSchema = t.object({
  cardId: t.number(),
  chosenNobleId: t.optional(t.number()),
});

export type BuyReservedCardInput = typeof buyReservedCardCommandSchema.static;

const buyReservedCardDiscoverySchema = t.object({
  selectedCardId: t.optional(t.number()),
  chosenNobleId: t.optional(t.number()),
});

const buyReservedCardCommand = defineSplendorCommand({
  commandId: "buy_reserved_card",
  commandSchema: buyReservedCardCommandSchema,
})
  .discoverable({
    discoverySchema: buyReservedCardDiscoverySchema,
    discover(context) {
      const actorId = assertAvailableActor(context);
      const game = context.game;
      const draft = context.discovery.input;
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
              nextInput: {
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
  })
  .isAvailable((context) => {
    return guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const game = context.game;
      const player = game.getPlayer(actorId);

      return player.reservedCardIds.some((cardId: number) => {
        const card = game.getCard(cardId);

        return player.getAffordablePayment(card) !== null;
      });
    });
  })
  .validate(({ runtime, game, command }) => {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, command.actorId);
      const input = command.input;
      const player = game.getPlayer(actorId);

      if (!input) {
        return { ok: false, reason: "card_required" };
      }

      if (!player.reservedCardIds.includes(input.cardId)) {
        return { ok: false, reason: "card_not_reserved" };
      }

      const card = game.getCard(input.cardId);

      if (!player.getAffordablePayment(card)) {
        return { ok: false, reason: "card_not_affordable" };
      }

      const hypotheticalPlayer = player.clone();
      hypotheticalPlayer.removeReservedCard(input.cardId);
      hypotheticalPlayer.buyCard(input.cardId);

      const eligibleNobles = game.getEligibleNobles(hypotheticalPlayer);

      if (eligibleNobles.length > 1 && !input.chosenNobleId) {
        return { ok: false, reason: "chosen_noble_required" };
      }

      if (
        input.chosenNobleId &&
        !eligibleNobles.some(
          (noble: { id: number }) => noble.id === input.chosenNobleId,
        )
      ) {
        return { ok: false, reason: "invalid_chosen_noble" };
      }

      return { ok: true };
    });
  })
  .execute(({ game, command, emitEvent }) => {
    const actorId = command.actorId!;
    const input = command.input!;
    const player = game.getPlayer(actorId);
    const card = game.getCard(input.cardId);
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
  })
  .build();

export { buyReservedCardCommand };
