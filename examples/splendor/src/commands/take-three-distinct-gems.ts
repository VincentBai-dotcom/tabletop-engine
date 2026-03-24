import type { CommandDefinition } from "tabletop-kernel";
import type {
  SplendorGameState,
  TakeThreeDistinctGemsPayload,
} from "../state.ts";
import { PlayerOps } from "../model/player-ops.ts";
import { SplendorGameOps } from "../model/game-ops.ts";
import { applyReturnTokens, validateReturnTokens } from "../model/token-ops.ts";
import {
  assertActivePlayer,
  assertGameActive,
  guardedValidate,
  readPayload,
} from "./shared.ts";

export const takeThreeDistinctGemsCommand: CommandDefinition<SplendorGameState> =
  {
    validate: ({ state, command }) =>
      guardedValidate(() => {
        assertGameActive(state.game);
        const actorId = assertActivePlayer(state, command.actorId);
        const payload = readPayload<TakeThreeDistinctGemsPayload>(command);

        if (!payload.colors || payload.colors.length !== 3) {
          return { ok: false, reason: "three_colors_required" };
        }

        const uniqueColors = new Set(payload.colors);

        if (uniqueColors.size !== 3) {
          return { ok: false, reason: "colors_must_be_distinct" };
        }

        const player = PlayerOps.clone(state.game.players[actorId]!);

        for (const color of payload.colors) {
          if (state.game.bank[color] <= 0) {
            return { ok: false, reason: "token_color_unavailable" };
          }

          player.tokens[color] += 1;
        }

        const requiredReturnCount = Math.max(
          new PlayerOps(player).getTokenCount() - 10,
          0,
        );

        if (
          !validateReturnTokens(
            player,
            payload.returnTokens,
            requiredReturnCount,
          )
        ) {
          return { ok: false, reason: "invalid_return_tokens" };
        }

        return { ok: true };
      }),
    execute: ({ game, command, emitEvent }) => {
      const actorId = command.actorId!;
      const payload = readPayload<TakeThreeDistinctGemsPayload>(command);
      const gameOps = new SplendorGameOps(game);
      const player = gameOps.getPlayer(actorId).state;

      for (const color of payload.colors) {
        game.bank[color] -= 1;
        player.tokens[color] += 1;
      }

      applyReturnTokens(player, game.bank, payload.returnTokens);
      emitEvent({
        category: "domain",
        type: "gems_taken",
        payload: {
          actorId,
          colors: payload.colors,
          returnTokens: payload.returnTokens ?? null,
        },
      });
    },
  };
