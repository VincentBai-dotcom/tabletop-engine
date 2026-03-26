import type { CommandDefinition } from "tabletop-kernel";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type { ReserveDeckCardPayload, SplendorGameState } from "../state.ts";
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

export class ReserveDeckCardCommand implements CommandDefinition<SplendorGameState> {
  readonly commandId = "reserve_deck_card";

  isAvailable(context: SplendorAvailabilityContext) {
    return guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const player = context.state.game.players[actorId]!;

      if (player.reservedCardIds.length >= 3) {
        return false;
      }

      return Object.values(context.state.game.board.deckByLevel).some(
        (cards) => cards.length > 0,
      );
    });
  }

  discover(context: SplendorDiscoveryContext) {
    const actorId = assertAvailableActor(context);
    const payload = readPayload<Partial<ReserveDeckCardPayload>>(
      context.partialCommand,
    );

    if (!payload.level) {
      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectDeckLevel,
        options: Object.entries(context.state.game.board.deckByLevel)
          .filter(([, cardIds]) => cardIds.length > 0)
          .map(([level]) => ({
            id: level,
            value: {
              ...payload,
              level: Number(level),
            },
            metadata: {
              level: Number(level),
              source: "deck",
            },
          })),
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
      const payload = readPayload<ReserveDeckCardPayload>(commandInput);
      const player = PlayerOps.clone(state.game.players[actorId]!);

      if (player.reservedCardIds.length >= 3) {
        return { ok: false, reason: "reserved_limit_reached" };
      }

      if (!payload.level) {
        return { ok: false, reason: "level_required" };
      }

      if (state.game.board.deckByLevel[payload.level].length === 0) {
        return { ok: false, reason: "deck_empty" };
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
    const payload = readPayload<ReserveDeckCardPayload>(commandInput);
    const gameOps = new SplendorGameOps(game);
    const player = gameOps.getPlayer(actorId).state;
    const reservedCardId = gameOps.reserveDeckCard(payload.level);

    player.reservedCardIds.push(reservedCardId);

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
        source: "deck",
        level: payload.level,
        cardId: reservedCardId,
        receivedGold,
        returnTokens: payload.returnTokens ?? null,
      },
    });
  }
}

export const reserveDeckCardCommand = new ReserveDeckCardCommand();
