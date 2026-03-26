import type { CommandDefinition } from "tabletop-kernel";
import {
  completeDiscovery,
  createNobleDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type { BuyFaceUpCardPayload, SplendorGameState } from "../state.ts";
import { PlayerOps } from "../model/player-ops.ts";
import { SplendorGameOps } from "../model/game-ops.ts";
import { applyTokenDelta } from "../model/token-ops.ts";
import {
  assertAvailableActor,
  assertActivePlayer,
  assertGameActive,
  guardedAvailability,
  guardedValidate,
  readPayload,
} from "./shared.ts";

export const buyFaceUpCardCommand: CommandDefinition<SplendorGameState> = {
  commandId: "buy_face_up_card",
  isAvailable: (context) =>
    guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const gameOps = new SplendorGameOps(context.state.game);
      const player = gameOps.getPlayer(actorId);

      return Object.entries(context.state.game.board.faceUpByLevel).some(
        ([level, cardIds]) =>
          cardIds.some((cardId) => {
            const card = gameOps.getCard(cardId);

            return (
              card.level === Number(level) &&
              player.getAffordablePayment(card) !== null
            );
          }),
      );
    }),
  discover: (context) => {
    const actorId = assertAvailableActor(context);
    const payload = readPayload<Partial<BuyFaceUpCardPayload>>(
      context.partialCommand,
    );
    const gameOps = new SplendorGameOps(context.state.game);
    const player = gameOps.getPlayer(actorId);

    if (!payload.level || !payload.cardId) {
      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard,
        options: Object.entries(context.state.game.board.faceUpByLevel).flatMap(
          ([level, cardIds]) =>
            cardIds
              .filter((cardId) => {
                const card = gameOps.getCard(cardId);

                return player.getAffordablePayment(card) !== null;
              })
              .map((cardId) => ({
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

    const hypotheticalPlayer = new PlayerOps(PlayerOps.clone(player.state));
    hypotheticalPlayer.buyCard(payload.cardId);
    const eligibleNobles = gameOps.getEligibleNobles(hypotheticalPlayer);
    const nobleDiscovery = createNobleDiscovery(payload, eligibleNobles);

    return nobleDiscovery ?? completeDiscovery(payload);
  },
  validate: ({ state, command }) =>
    guardedValidate(() => {
      assertGameActive(state.game);
      const actorId = assertActivePlayer(state, command.actorId);
      const payload = readPayload<BuyFaceUpCardPayload>(command);
      const gameOps = new SplendorGameOps(state.game);

      if (!payload.cardId || !payload.level) {
        return { ok: false, reason: "level_and_card_required" };
      }

      if (
        !state.game.board.faceUpByLevel[payload.level].includes(payload.cardId)
      ) {
        return { ok: false, reason: "card_not_face_up" };
      }

      const player = gameOps.getPlayer(actorId);
      const card = gameOps.getCard(payload.cardId);

      if (!player.getAffordablePayment(card)) {
        return { ok: false, reason: "card_not_affordable" };
      }

      const hypotheticalPlayer = new PlayerOps(PlayerOps.clone(player.state));
      hypotheticalPlayer.buyCard(payload.cardId);

      const eligibleNobles = gameOps.getEligibleNobles(hypotheticalPlayer);

      if (eligibleNobles.length > 1 && !payload.chosenNobleId) {
        return { ok: false, reason: "chosen_noble_required" };
      }

      if (
        payload.chosenNobleId &&
        !eligibleNobles.some((noble) => noble.id === payload.chosenNobleId)
      ) {
        return { ok: false, reason: "invalid_chosen_noble" };
      }

      return { ok: true };
    }),
  execute: ({ game, command, emitEvent }) => {
    const actorId = command.actorId!;
    const payload = readPayload<BuyFaceUpCardPayload>(command);
    const gameOps = new SplendorGameOps(game);
    const player = gameOps.getPlayer(actorId);
    const card = gameOps.getCard(payload.cardId);
    const payment = player.getAffordablePayment(card);

    if (!payment) {
      throw new Error("card_not_affordable");
    }

    applyTokenDelta(player.state.tokens, payment, -1);
    applyTokenDelta(game.bank, payment, 1);
    player.buyCard(card.id);
    gameOps.removeFaceUpCard(payload.level, card.id);
    gameOps.replenishFaceUpCard(payload.level);
    emitEvent({
      category: "domain",
      type: "card_purchased",
      payload: {
        actorId,
        source: "face_up",
        level: payload.level,
        cardId: card.id,
        payment,
      },
    });
  },
};
