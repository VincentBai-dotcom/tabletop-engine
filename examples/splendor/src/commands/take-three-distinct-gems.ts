import type { CommandDefinition } from "tabletop-kernel";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type {
  GemTokenColor,
  ReturnTokensPayload,
  SplendorGameState,
  TakeThreeDistinctGemsPayload,
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
  type SplendorAvailabilityContext,
  type SplendorDiscoveryContext,
  type SplendorExecuteContext,
  type SplendorValidationContext,
} from "./shared.ts";

export class TakeThreeDistinctGemsCommand implements CommandDefinition<SplendorGameState> {
  readonly commandId = "take_three_distinct_gems";

  isAvailable(context: SplendorAvailabilityContext) {
    return guardedAvailability(() => {
      assertAvailableActor(context);

      return (
        Object.entries(context.state.game.bank).filter(
          ([color, count]) => color !== "gold" && count > 0,
        ).length >= 3
      );
    });
  }

  discover(context: SplendorDiscoveryContext) {
    const actorId = assertAvailableActor(context);
    const payload = readPayload<
      Partial<TakeThreeDistinctGemsPayload> & {
        colors?: GemTokenColor[];
        returnTokens?: ReturnTokensPayload;
      }
    >(context.partialCommand);
    const selectedColors: GemTokenColor[] = payload.colors
      ? [...payload.colors]
      : [];

    if (selectedColors.length < 3) {
      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectGemColor,
        options: Object.entries(context.state.game.bank)
          .filter(
            ([color, count]) =>
              color !== "gold" &&
              count > 0 &&
              !selectedColors.includes(color as GemTokenColor),
          )
          .map(([color]) => ({
            id: color,
            value: {
              ...payload,
              colors: [...selectedColors, color] as GemTokenColor[],
            },
            metadata: {
              color,
              selectedCount: selectedColors.length,
              requiredCount: 3,
            },
          })),
      };
    }

    const player = PlayerOps.clone(context.state.game.players[actorId]!);

    for (const color of selectedColors) {
      player.tokens[color] += 1;
    }

    const requiredReturnCount = Math.max(
      new PlayerOps(player).getTokenCount() - 10,
      0,
    );
    const returnDiscovery = createReturnTokenDiscovery(
      {
        ...payload,
        colors: [...selectedColors] as GemTokenColor[],
      },
      player.tokens,
      requiredReturnCount,
    );

    return (
      returnDiscovery ??
      completeDiscovery({
        ...payload,
        colors: [...selectedColors] as GemTokenColor[],
      })
    );
  }

  validate({ state, commandInput }: SplendorValidationContext) {
    return guardedValidate(() => {
      assertGameActive(state.game);
      const actorId = assertActivePlayer(state, commandInput.actorId);
      const payload = readPayload<TakeThreeDistinctGemsPayload>(commandInput);

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
        !validateReturnTokens(player, payload.returnTokens, requiredReturnCount)
      ) {
        return { ok: false, reason: "invalid_return_tokens" };
      }

      return { ok: true };
    });
  }

  execute({ game, commandInput, emitEvent }: SplendorExecuteContext) {
    const actorId = commandInput.actorId!;
    const payload = readPayload<TakeThreeDistinctGemsPayload>(commandInput);
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
  }
}

export const takeThreeDistinctGemsCommand = new TakeThreeDistinctGemsCommand();
