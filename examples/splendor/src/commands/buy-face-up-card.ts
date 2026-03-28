import type { CommandDefinition } from "tabletop-kernel";
import {
  completeDiscovery,
  createNobleDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type {
  BuyFaceUpCardPayload,
  SplendorGameStateFacade,
} from "../state.ts";
import { PlayerOps } from "../model/player-ops.ts";
import { applyTokenDelta } from "../model/token-ops.ts";
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

export class BuyFaceUpCardCommand implements CommandDefinition<SplendorGameStateFacade> {
  readonly commandId = "buy_face_up_card";

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

  discover(context: SplendorDiscoveryContext) {
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

    const hypotheticalPlayer = new PlayerOps(PlayerOps.clone(player.state));
    hypotheticalPlayer.buyCard(payload.cardId);
    const eligibleNobles = game.getEligibleNobles(hypotheticalPlayer);
    const nobleDiscovery = createNobleDiscovery(payload, eligibleNobles);

    return nobleDiscovery ?? completeDiscovery(payload);
  }

  validate({ runtime, game, commandInput }: SplendorValidationContext) {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, commandInput.actorId);
      const payload = readPayload<BuyFaceUpCardPayload>(commandInput);

      if (!payload.cardId || !payload.level) {
        return { ok: false, reason: "level_and_card_required" };
      }

      if (!game.board.faceUpByLevel[payload.level].includes(payload.cardId)) {
        return { ok: false, reason: "card_not_face_up" };
      }

      const player = game.getPlayer(actorId);
      const card = game.getCard(payload.cardId);

      if (!player.getAffordablePayment(card)) {
        return { ok: false, reason: "card_not_affordable" };
      }

      const hypotheticalPlayer = new PlayerOps(PlayerOps.clone(player.state));
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
    const payload = readPayload<BuyFaceUpCardPayload>(commandInput);
    const player = game.getPlayer(actorId);
    const card = game.getCard(payload.cardId);
    const payment = player.getAffordablePayment(card);

    if (!payment) {
      throw new Error("card_not_affordable");
    }

    applyTokenDelta(player.state.tokens, payment, -1);
    applyTokenDelta(game.bank, payment, 1);
    player.buyCard(card.id);
    game.board.removeFaceUpCard(payload.level, card.id);
    game.board.replenishFaceUpCard(payload.level);
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
  }
}

export const buyFaceUpCardCommand = new BuyFaceUpCardCommand();
