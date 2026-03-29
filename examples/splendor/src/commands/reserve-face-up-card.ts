import { t, type CommandDefinition } from "tabletop-kernel";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type { ReserveFaceUpCardPayload, SplendorGameState } from "../state.ts";
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

const reserveFaceUpCardPayloadSchema = t.object({
  level: t.optional(t.number()),
  cardId: t.optional(t.number()),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

export class ReserveFaceUpCardCommand implements CommandDefinition<SplendorGameState> {
  readonly commandId = "reserve_face_up_card";
  readonly payloadSchema = reserveFaceUpCardPayloadSchema;

  isAvailable(context: SplendorAvailabilityContext) {
    return guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const game = context.game;
      const player = game.getPlayer(actorId);
      const faceUpPiles = Object.values(game.board.faceUpByLevel) as number[][];

      if (!player.canReserveMoreCards()) {
        return false;
      }

      return faceUpPiles.some((cards) => cards.length > 0);
    });
  }

  discover(context: SplendorDiscoveryContext) {
    const actorId = assertAvailableActor(context);
    const game = context.game;
    const payload = readPayload<Partial<ReserveFaceUpCardPayload>>(
      context.partialCommand,
    );
    const faceUpEntries = Object.entries(game.board.faceUpByLevel) as Array<
      [string, number[]]
    >;

    if (!payload.level || !payload.cardId) {
      return {
        step: SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard,
        options: faceUpEntries.flatMap(([level, cardIds]) =>
          cardIds.map((cardId: number) => ({
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

    const player = game.getPlayer(actorId).clone();

    if (game.bank.gold > 0) {
      player.tokens.adjustColor("gold", 1);
    }

    const requiredReturnCount = player.getRequiredReturnCount();
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
      const payload = readPayload<ReserveFaceUpCardPayload>(commandInput);
      const player = game.getPlayer(actorId).clone();

      if (!player.canReserveMoreCards()) {
        return { ok: false, reason: "reserved_limit_reached" };
      }

      if (!payload.cardId || !payload.level) {
        return { ok: false, reason: "level_and_card_required" };
      }

      if (!game.board.faceUpByLevel[payload.level].includes(payload.cardId)) {
        return { ok: false, reason: "card_not_face_up" };
      }

      if (game.bank.gold > 0) {
        player.tokens.adjustColor("gold", 1);
      }

      if (
        !player.canReturnTokens(
          payload.returnTokens,
          player.getRequiredReturnCount(),
        )
      ) {
        return { ok: false, reason: "invalid_return_tokens" };
      }

      return { ok: true };
    });
  }

  execute({ game, commandInput, emitEvent }: SplendorExecuteContext) {
    const actorId = commandInput.actorId!;
    const payload = readPayload<ReserveFaceUpCardPayload>(commandInput);
    const player = game.getPlayer(actorId);

    player.reserveCard(payload.cardId);
    game.board.removeFaceUpCard(payload.level, payload.cardId);
    game.board.replenishFaceUpCard(payload.level);

    const receivedGold = player.gainGoldFrom(game.bank);
    player.returnTokensTo(game.bank, payload.returnTokens);
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
