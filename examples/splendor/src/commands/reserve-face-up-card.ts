import type { CommandDefinition } from "tabletop-kernel";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type { ReserveFaceUpCardPayload, SplendorGameState } from "../state.ts";
import { PlayerOps } from "../model/player-ops.ts";
import { SplendorGameOps } from "../model/game-ops.ts";
import { applyReturnTokens, validateReturnTokens } from "../model/token-ops.ts";
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

export class ReserveFaceUpCardCommand implements CommandDefinition<SplendorGameState> {
  readonly commandId = "reserve_face_up_card";

  isAvailable(context: SplendorAvailabilityContext) {
    return guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const player = context.state.game.players[actorId]!;

      if (player.reservedCardIds.length >= 3) {
        return false;
      }

      return Object.values(context.state.game.board.faceUpByLevel).some(
        (cards) => cards.length > 0,
      );
    });
  }

  discover(context: SplendorDiscoveryContext) {
    const actorId = assertAvailableActor(context);
    const payload = readPayload<Partial<ReserveFaceUpCardPayload>>(
      context.partialCommand,
    );

    if (!payload.level || !payload.cardId) {
      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard,
        options: Object.entries(context.state.game.board.faceUpByLevel).flatMap(
          ([level, cardIds]) =>
            cardIds.map((cardId) => ({
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

    const player = PlayerOps.clone(context.state.game.players[actorId]!);

    if (context.state.game.bank.gold > 0) {
      player.tokens.gold += 1;
    }

    const requiredReturnCount = Math.max(
      new PlayerOps(player).getTokenCount() - 10,
      0,
    );
    const returnDiscovery = createReturnTokenDiscovery(
      payload,
      player.tokens,
      requiredReturnCount,
    );

    return returnDiscovery ?? completeDiscovery(payload);
  }

  validate({ state, commandInput }: SplendorValidationContext) {
    return guardedValidate(() => {
      assertGameActive(state.game);
      const actorId = assertActivePlayer(state, commandInput.actorId);
      const payload = readPayload<ReserveFaceUpCardPayload>(commandInput);
      const player = PlayerOps.clone(state.game.players[actorId]!);

      if (player.reservedCardIds.length >= 3) {
        return { ok: false, reason: "reserved_limit_reached" };
      }

      if (!payload.cardId || !payload.level) {
        return { ok: false, reason: "level_and_card_required" };
      }

      if (
        !state.game.board.faceUpByLevel[payload.level].includes(payload.cardId)
      ) {
        return { ok: false, reason: "card_not_face_up" };
      }

      if (state.game.bank.gold > 0) {
        player.tokens.gold += 1;
      }

      const requiredReturnCount = Math.max(
        new PlayerOps(player).getTokenCount() - 10,
        0,
      );

      if (
        !validateReturnTokens(player, payload.returnTokens, requiredReturnCount)
      ) {
        return { ok: false, reason: "invalid_return_tokens" };
      }

      return { ok: true };
    });
  }

  execute({ game, commandInput, emitEvent }: SplendorExecuteContext) {
    const actorId = commandInput.actorId!;
    const payload = readPayload<ReserveFaceUpCardPayload>(commandInput);
    const gameOps = new SplendorGameOps(game);
    const player = gameOps.getPlayer(actorId).state;

    player.reservedCardIds.push(payload.cardId);
    gameOps.removeFaceUpCard(payload.level, payload.cardId);
    gameOps.replenishFaceUpCard(payload.level);

    const receivedGold = game.bank.gold > 0;

    if (receivedGold) {
      game.bank.gold -= 1;
      player.tokens.gold += 1;
    }

    applyReturnTokens(player, game.bank, payload.returnTokens);
    emitEvent({
      category: "domain",
      type: "card_reserved",
      payload: {
        actorId,
        source: "face_up",
        level: payload.level,
        cardId: payload.cardId,
        receivedGold,
        returnTokens: payload.returnTokens ?? null,
      },
    });
  }
}

export const reserveFaceUpCardCommand = new ReserveFaceUpCardCommand();
