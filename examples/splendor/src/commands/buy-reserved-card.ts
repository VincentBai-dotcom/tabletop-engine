import type { CommandDefinition } from "tabletop-kernel";
import {
  completeDiscovery,
  createNobleDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type { BuyReservedCardPayload, SplendorGameState } from "../state.ts";
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
  type SplendorAvailabilityContext,
  type SplendorDiscoveryContext,
  type SplendorExecuteContext,
  type SplendorValidationContext,
} from "./shared.ts";

export class BuyReservedCardCommand implements CommandDefinition<SplendorGameState> {
  readonly commandId = "buy_reserved_card";

  isAvailable(context: SplendorAvailabilityContext) {
    return guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const gameOps = new SplendorGameOps(context.state.game);
      const player = gameOps.getPlayer(actorId);

      return player.state.reservedCardIds.some((cardId) => {
        const card = gameOps.getCard(cardId);

        return player.getAffordablePayment(card) !== null;
      });
    });
  }

  discover(context: SplendorDiscoveryContext) {
    const actorId = assertAvailableActor(context);
    const payload = readPayload<Partial<BuyReservedCardPayload>>(
      context.partialCommand,
    );
    const gameOps = new SplendorGameOps(context.state.game);
    const player = gameOps.getPlayer(actorId);

    if (!payload.cardId) {
      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectReservedCard,
        options: player.state.reservedCardIds
          .filter((cardId) => {
            const card = gameOps.getCard(cardId);

            return player.getAffordablePayment(card) !== null;
          })
          .map((cardId) => ({
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

    const hypotheticalPlayer = new PlayerOps(PlayerOps.clone(player.state));
    hypotheticalPlayer.removeReservedCard(payload.cardId);
    hypotheticalPlayer.buyCard(payload.cardId);
    const eligibleNobles = gameOps.getEligibleNobles(hypotheticalPlayer);
    const nobleDiscovery = createNobleDiscovery(payload, eligibleNobles);

    return nobleDiscovery ?? completeDiscovery(payload);
  }

  validate({ state, commandInput }: SplendorValidationContext) {
    return guardedValidate(() => {
      assertGameActive(state.game);
      const actorId = assertActivePlayer(state, commandInput.actorId);
      const payload = readPayload<BuyReservedCardPayload>(commandInput);
      const gameOps = new SplendorGameOps(state.game);
      const player = gameOps.getPlayer(actorId);

      if (!payload.cardId) {
        return { ok: false, reason: "card_required" };
      }

      if (!player.state.reservedCardIds.includes(payload.cardId)) {
        return { ok: false, reason: "card_not_reserved" };
      }

      const card = gameOps.getCard(payload.cardId);

      if (!player.getAffordablePayment(card)) {
        return { ok: false, reason: "card_not_affordable" };
      }

      const hypotheticalPlayer = new PlayerOps(PlayerOps.clone(player.state));
      hypotheticalPlayer.removeReservedCard(payload.cardId);
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
    });
  }

  execute({ game, commandInput, emitEvent }: SplendorExecuteContext) {
    const actorId = commandInput.actorId!;
    const payload = readPayload<BuyReservedCardPayload>(commandInput);
    const gameOps = new SplendorGameOps(game);
    const player = gameOps.getPlayer(actorId);
    const card = gameOps.getCard(payload.cardId);
    const payment = player.getAffordablePayment(card);

    if (!payment) {
      throw new Error("card_not_affordable");
    }

    applyTokenDelta(player.state.tokens, payment, -1);
    applyTokenDelta(game.bank, payment, 1);
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
