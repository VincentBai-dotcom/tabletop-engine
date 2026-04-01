import { t } from "tabletop-engine";
import {
  completeDiscovery,
  createNobleDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import {
  assertDevelopmentLevel,
  assertAvailableActor,
  assertActivePlayer,
  assertGameActive,
  guardedAvailability,
  guardedValidate,
  isDevelopmentLevel,
  defineSplendorCommand,
} from "./shared.ts";

const buyFaceUpCardPayloadSchema = t.object({
  level: t.number(),
  cardId: t.number(),
  chosenNobleId: t.optional(t.number()),
});

export type BuyFaceUpCardPayload = typeof buyFaceUpCardPayloadSchema.static;

const buyFaceUpCardDraftSchema = t.object({
  selectedLevel: t.optional(t.number()),
  selectedCardId: t.optional(t.number()),
  chosenNobleId: t.optional(t.number()),
});

const buyFaceUpCardCommand = defineSplendorCommand({
  commandId: "buy_face_up_card",
  payloadSchema: buyFaceUpCardPayloadSchema,
  discoveryDraftSchema: buyFaceUpCardDraftSchema,

  isAvailable(context) {
    return guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const game = context.game;
      const player = game.getPlayer(actorId);
      const faceUpEntries = Object.entries(game.board.faceUpByLevel) as Array<
        [string, number[]]
      >;

      return faceUpEntries.some(([level, cardIds]) =>
        cardIds.some((cardId: number) => {
          const card = game.getCard(cardId);

          return (
            card.level === Number(level) &&
            player.getAffordablePayment(card) !== null
          );
        }),
      );
    });
  },

  discover(context) {
    const actorId = assertAvailableActor(context);
    const game = context.game;
    const draft = context.discoveryInput.draft;
    const player = game.getPlayer(actorId);
    const faceUpEntries = Object.entries(game.board.faceUpByLevel) as Array<
      [string, number[]]
    >;

    if (!draft?.selectedLevel || !draft?.selectedCardId) {
      return {
        complete: false as const,
        step: SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard,
        options: faceUpEntries.flatMap(([level, cardIds]) =>
          cardIds
            .filter((cardId: number) => {
              const card = game.getCard(cardId);

              return player.getAffordablePayment(card) !== null;
            })
            .map((cardId: number) => ({
              id: `${level}:${cardId}`,
              nextDraft: {
                ...(draft ?? {}),
                selectedLevel: Number(level),
                selectedCardId: cardId,
              },
              metadata: {
                level: Number(level),
                cardId,
                source: "face_up",
              },
            })),
        ),
      };
    }

    const hypotheticalPlayer = player.clone();
    hypotheticalPlayer.buyCard(draft.selectedCardId);
    const eligibleNobles = game.getEligibleNobles(hypotheticalPlayer);
    const nobleDiscovery = createNobleDiscovery(draft, eligibleNobles);

    return (
      nobleDiscovery ??
      completeDiscovery({
        level: draft.selectedLevel,
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

      if (!payload) {
        return { ok: false, reason: "level_and_card_required" };
      }

      const level = payload.level;

      if (!isDevelopmentLevel(level)) {
        return { ok: false, reason: "invalid_level" };
      }

      if (!game.board.faceUpByLevel[level].includes(payload.cardId)) {
        return { ok: false, reason: "card_not_face_up" };
      }

      const player = game.getPlayer(actorId);
      const card = game.getCard(payload.cardId);

      if (!player.getAffordablePayment(card)) {
        return { ok: false, reason: "card_not_affordable" };
      }

      const hypotheticalPlayer = player.clone();
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
    const level = assertDevelopmentLevel(payload.level);
    const player = game.getPlayer(actorId);
    const card = game.getCard(payload.cardId);
    const payment = player.getAffordablePayment(card);

    if (!payment) {
      throw new Error("card_not_affordable");
    }

    player.tokens.transferTo(game.bank, payment);
    player.buyCard(card.id);
    game.board.removeFaceUpCard(level, card.id);
    game.board.replenishFaceUpCard(level);
    emitEvent({
      category: "domain",
      type: "card_purchased",
      payload: {
        actorId,
        source: "face_up",
        level,
        cardId: card.id,
        payment,
      },
    });
  },
});

export { buyFaceUpCardCommand };
