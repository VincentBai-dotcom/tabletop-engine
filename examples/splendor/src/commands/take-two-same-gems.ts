import type { CommandDefinition } from "tabletop-kernel";
import type { SplendorGameState, TakeTwoSameGemsPayload } from "../state.ts";
import { PlayerOps } from "../model/player-ops.ts";
import { SplendorGameOps } from "../model/game-ops.ts";
import { applyReturnTokens, validateReturnTokens } from "../model/token-ops.ts";
import {
  assertActivePlayer,
  assertGameActive,
  guardedValidate,
  readPayload,
} from "./shared.ts";

export const takeTwoSameGemsCommand: CommandDefinition<SplendorGameState> = {
  validate: ({ state, command }) =>
    guardedValidate(() => {
      assertGameActive(state.game);
      const actorId = assertActivePlayer(state, command.actorId);
      const payload = readPayload<TakeTwoSameGemsPayload>(command);

      if (!payload.color) {
        return { ok: false, reason: "color_required" };
      }

      if (state.game.bank[payload.color] < 4) {
        return { ok: false, reason: "not_enough_tokens_for_double_take" };
      }

      const player = PlayerOps.clone(state.game.players[actorId]!);
      player.tokens[payload.color] += 2;
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
    const payload = readPayload<TakeTwoSameGemsPayload>(command);
    const gameOps = new SplendorGameOps(game);
    const player = gameOps.getPlayer(actorId).state;

    game.bank[payload.color] -= 2;
    player.tokens[payload.color] += 2;
    applyReturnTokens(player, game.bank, payload.returnTokens);
    emitEvent({
      category: "domain",
      type: "double_gem_taken",
      payload: {
        actorId,
        color: payload.color,
        returnTokens: payload.returnTokens ?? null,
      },
    });
  },
};
