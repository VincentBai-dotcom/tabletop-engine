import type { CommandDefinition } from "tabletop-kernel";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type {
  ReturnTokensPayload,
  SplendorGameState,
  TakeTwoSameGemsPayload,
} from "../state.ts";
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
} from "./shared.ts";

export const takeTwoSameGemsCommand: CommandDefinition<SplendorGameState> = {
  commandId: "take_two_same_gems",
  isAvailable: (context) =>
    guardedAvailability(() => {
      assertAvailableActor(context);

      return Object.entries(context.state.game.bank).some(
        ([color, count]) => color !== "gold" && count >= 4,
      );
    }),
  discover: (context) => {
    const actorId = assertAvailableActor(context);
    const payload = readPayload<
      Partial<TakeTwoSameGemsPayload> & {
        returnTokens?: ReturnTokensPayload;
      }
    >(context.partialCommand);

    if (!payload.color) {
      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
        options: Object.entries(context.state.game.bank)
          .filter(([color, count]) => color !== "gold" && count >= 4)
          .map(([color]) => ({
            id: color,
            value: {
              ...payload,
              color,
            },
            metadata: {
              color,
              amount: 2,
            },
          })),
      };
    }

    const player = PlayerOps.clone(context.state.game.players[actorId]!);
    player.tokens[payload.color] += 2;
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
  },
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
