import type { CommandDefinition } from "tabletop-kernel";
import type { ReserveFaceUpCardPayload, SplendorGameState } from "../state.ts";
import { PlayerOps } from "../model/player-ops.ts";
import { SplendorGameOps } from "../model/game-ops.ts";
import { applyReturnTokens, validateReturnTokens } from "../model/token-ops.ts";
import {
  assertActivePlayer,
  assertGameActive,
  guardedValidate,
  readPayload,
} from "./shared.ts";

export const reserveFaceUpCardCommand: CommandDefinition<SplendorGameState> = {
  validate: ({ state, command }) =>
    guardedValidate(() => {
      assertGameActive(state.game);
      const actorId = assertActivePlayer(state, command.actorId);
      const payload = readPayload<ReserveFaceUpCardPayload>(command);
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
    }),
  execute: ({ game, command, emitEvent }) => {
    const actorId = command.actorId!;
    const payload = readPayload<ReserveFaceUpCardPayload>(command);
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
  },
};
