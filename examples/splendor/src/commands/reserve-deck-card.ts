import type { CommandDefinition } from "tabletop-kernel";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type {
  ReserveDeckCardPayload,
  SplendorGameStateFacade,
} from "../state.ts";
import { PlayerOps } from "../model/player-ops.ts";
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

export class ReserveDeckCardCommand implements CommandDefinition<SplendorGameStateFacade> {
  readonly commandId = "reserve_deck_card";

  isAvailable(context: SplendorAvailabilityContext) {
    return guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const game = context.game;
      const player = game.players[actorId]!;
      const decks = Object.values(game.board.deckByLevel) as number[][];

      if (player.reservedCardIds.length >= 3) {
        return false;
      }

      return decks.some((cards) => cards.length > 0);
    });
  }

  discover(context: SplendorDiscoveryContext) {
    const actorId = assertAvailableActor(context);
    const game = context.game;
    const payload = readPayload<Partial<ReserveDeckCardPayload>>(
      context.partialCommand,
    );
    const deckEntries = Object.entries(game.board.deckByLevel) as Array<
      [string, number[]]
    >;

    if (!payload.level) {
      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectDeckLevel,
        options: deckEntries
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

    const player = PlayerOps.clone(game.players[actorId]!);

    if (game.bank.gold > 0) {
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

  validate({ runtime, game, commandInput }: SplendorValidationContext) {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, commandInput.actorId);
      const payload = readPayload<ReserveDeckCardPayload>(commandInput);
      const player = PlayerOps.clone(game.players[actorId]!);

      if (player.reservedCardIds.length >= 3) {
        return { ok: false, reason: "reserved_limit_reached" };
      }

      if (!payload.level) {
        return { ok: false, reason: "level_required" };
      }

      if (game.board.deckByLevel[payload.level].length === 0) {
        return { ok: false, reason: "deck_empty" };
      }

      if (game.bank.gold > 0) {
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
    const player = game.getPlayer(actorId).state;
    const reservedCardId = game.board.reserveDeckCard(payload.level);

    player.reservedCardIds.push(reservedCardId);

    const receivedGold = game.bank.gold > 0;

    if (receivedGold) {
      game.bank.adjustColor("gold", -1);
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
