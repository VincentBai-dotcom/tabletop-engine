import { t, type CommandDefinition } from "tabletop-engine";
import {
  completeDiscovery,
  createNobleDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type { SplendorGameState } from "../state.ts";
import {
  assertDevelopmentLevel,
  assertAvailableActor,
  assertActivePlayer,
  assertGameActive,
  guardedAvailability,
  guardedValidate,
  isDevelopmentLevel,
  readPayload,
  type SplendorAvailabilityContext,
  type SplendorDiscoveryContext,
  type SplendorExecuteContext,
  type SplendorValidationContext,
} from "./shared.ts";

const buyFaceUpCardPayloadSchema = t.object({
  level: t.optional(t.number()),
  cardId: t.optional(t.number()),
  chosenNobleId: t.optional(t.number()),
});

export type BuyFaceUpCardPayload = typeof buyFaceUpCardPayloadSchema.static;

export class BuyFaceUpCardCommand implements CommandDefinition<
  SplendorGameState,
  BuyFaceUpCardPayload
> {
  readonly commandId = "buy_face_up_card";
  readonly payloadSchema = buyFaceUpCardPayloadSchema;

  isAvailable(context: SplendorAvailabilityContext) {
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
  }

  discover(context: SplendorDiscoveryContext<BuyFaceUpCardPayload>) {
    const actorId = assertAvailableActor(context);
    const game = context.game;
    const payload = readPayload<Partial<BuyFaceUpCardPayload>>(
      context.partialCommand,
    );
    const player = game.getPlayer(actorId);
    const faceUpEntries = Object.entries(game.board.faceUpByLevel) as Array<
      [string, number[]]
    >;

    if (!payload.level || !payload.cardId) {
      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard,
        options: faceUpEntries.flatMap(([level, cardIds]) =>
          cardIds
            .filter((cardId: number) => {
              const card = game.getCard(cardId);

              return player.getAffordablePayment(card) !== null;
            })
            .map((cardId: number) => ({
              id: `${level}:${cardId}`,
              value: {
                ...payload,
                level: Number(level),
                cardId,
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
    hypotheticalPlayer.buyCard(payload.cardId);
    const eligibleNobles = game.getEligibleNobles(hypotheticalPlayer);
    const nobleDiscovery = createNobleDiscovery(payload, eligibleNobles);

    return nobleDiscovery ?? completeDiscovery(payload);
  }

  validate({
    runtime,
    game,
    commandInput,
  }: SplendorValidationContext<BuyFaceUpCardPayload>) {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, commandInput.actorId);
      const payload = readPayload<BuyFaceUpCardPayload>(commandInput);

      if (!payload.cardId || !payload.level) {
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
  }

  execute({
    game,
    commandInput,
    emitEvent,
  }: SplendorExecuteContext<BuyFaceUpCardPayload>) {
    const actorId = commandInput.actorId!;
    const payload = readPayload<BuyFaceUpCardPayload>(commandInput);
    if (!payload.cardId || !payload.level) {
      throw new Error("level_and_card_required");
    }

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
  }
}

export const buyFaceUpCardCommand = new BuyFaceUpCardCommand();
