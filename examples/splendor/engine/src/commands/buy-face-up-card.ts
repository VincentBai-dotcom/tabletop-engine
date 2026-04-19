import { t } from "tabletop-engine";
import { completeDiscovery, SPLENDOR_DISCOVERY_STEPS } from "../discovery.ts";
import {
  assertDevelopmentLevel,
  guardedAvailability,
  guardedValidate,
  isDevelopmentLevel,
  defineSplendorCommand,
} from "./shared.ts";

const buyFaceUpCardCommandSchema = t.object({
  level: t.number(),
  cardId: t.number(),
});

export type BuyFaceUpCardInput = typeof buyFaceUpCardCommandSchema.static;

const buyFaceUpCardDiscoverySchema = t.object({
  selectedLevel: t.optional(t.number()),
  selectedCardId: t.optional(t.number()),
});

const buyFaceUpCardCommand = defineSplendorCommand({
  commandId: "buy_face_up_card",
  commandSchema: buyFaceUpCardCommandSchema,
})
  .discoverable({
    discoverySchema: buyFaceUpCardDiscoverySchema,
    discover(context) {
      const actorId = context.actorId;
      const game = context.game;
      const draft = context.discovery.input;
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
                nextInput: {
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

      return completeDiscovery({
        level: draft.selectedLevel,
        cardId: draft.selectedCardId,
      });
    },
  })
  .isAvailable((context) => {
    return guardedAvailability(() => {
      const actorId = context.actorId;
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
  })
  .validate(({ game, command }) => {
    return guardedValidate(() => {
      const actorId = command.actorId;
      const input = command.input;

      const level = input.level;

      if (!isDevelopmentLevel(level)) {
        return { ok: false, reason: "invalid_level" };
      }

      if (!game.board.faceUpByLevel[level].includes(input.cardId)) {
        return { ok: false, reason: "card_not_face_up" };
      }

      const player = game.getPlayer(actorId);
      const card = game.getCard(input.cardId);

      if (!player.getAffordablePayment(card)) {
        return { ok: false, reason: "card_not_affordable" };
      }

      return { ok: true };
    });
  })
  .execute(({ game, command, emitEvent }) => {
    const actorId = command.actorId;
    const input = command.input;
    const level = assertDevelopmentLevel(input.level);
    const player = game.getPlayer(actorId);
    const card = game.getCard(input.cardId);
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
  })
  .build();

export { buyFaceUpCardCommand };
