import type { CommandDefinition } from "tabletop-kernel";
import type { ReserveDeckCardPayload, SplendorGameState } from "../state.ts";
import { PlayerOps } from "../model/player-ops.ts";
import { SplendorGameOps } from "../model/game-ops.ts";
import { applyReturnTokens, validateReturnTokens } from "../model/token-ops.ts";
import {
  assertActivePlayer,
  assertGameActive,
  guardedValidate,
  readPayload,
} from "./shared.ts";

export const reserveDeckCardCommand: CommandDefinition<SplendorGameState> = {
  validate: ({ state, command }) =>
    guardedValidate(() => {
      assertGameActive(state.game);
      const actorId = assertActivePlayer(state, command.actorId);
      const payload = readPayload<ReserveDeckCardPayload>(command);
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
    }),
  execute: ({ game, command, emitEvent }) => {
    const actorId = command.actorId!;
    const payload = readPayload<ReserveDeckCardPayload>(command);
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
  },
};
