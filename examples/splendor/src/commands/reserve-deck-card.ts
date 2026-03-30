import { t, type CommandDefinition } from "tabletop-engine";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import type { SplendorGameState } from "../state.ts";
import {
  assertDevelopmentLevel,
  assertAvailableActor,
  assertActivePlayer,
  assertGameActive,
  guardedAvailability,
  guardedValidate,
  isDevelopmentLevel,
  readPayload,
  type SplendorAvailabilityContext,
  type SplendorDiscoveryContext,
  type SplendorExecuteContext,
  type SplendorValidationContext,
} from "./shared.ts";

const reserveDeckCardPayloadSchema = t.object({
  level: t.optional(t.number()),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

export type ReserveDeckCardPayload = typeof reserveDeckCardPayloadSchema.static;

export class ReserveDeckCardCommand implements CommandDefinition<
  SplendorGameState,
  ReserveDeckCardPayload
> {
  readonly commandId = "reserve_deck_card";
  readonly payloadSchema = reserveDeckCardPayloadSchema;

  isAvailable(context: SplendorAvailabilityContext) {
    return guardedAvailability(() => {
      const actorId = assertAvailableActor(context);
      const game = context.game;
      const player = game.getPlayer(actorId);
      const decks = Object.values(game.board.deckByLevel) as number[][];

      if (!player.canReserveMoreCards()) {
        return false;
      }

      return decks.some((cards) => cards.length > 0);
    });
  }

  discover(context: SplendorDiscoveryContext<ReserveDeckCardPayload>) {
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

  validate({
    runtime,
    game,
    commandInput,
  }: SplendorValidationContext<ReserveDeckCardPayload>) {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, commandInput.actorId);
      const payload = readPayload<ReserveDeckCardPayload>(commandInput);
      const player = game.getPlayer(actorId).clone();

      if (!player.canReserveMoreCards()) {
        return { ok: false, reason: "reserved_limit_reached" };
      }

      if (!payload.level) {
        return { ok: false, reason: "level_required" };
      }

      const level = payload.level;

      if (!isDevelopmentLevel(level)) {
        return { ok: false, reason: "invalid_level" };
      }

      if (game.board.deckByLevel[level].length === 0) {
        return { ok: false, reason: "deck_empty" };
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

  execute({
    game,
    commandInput,
    emitEvent,
  }: SplendorExecuteContext<ReserveDeckCardPayload>) {
    const actorId = commandInput.actorId!;
    const payload = readPayload<ReserveDeckCardPayload>(commandInput);
    const level = assertDevelopmentLevel(payload.level);
    const player = game.getPlayer(actorId);
    const reservedCardId = game.board.reserveDeckCard(level);

    player.reserveCard(reservedCardId);
    const receivedGold = player.gainGoldFrom(game.bank);
    player.returnTokensTo(game.bank, payload.returnTokens);
    emitEvent({
      category: "domain",
      type: "card_reserved",
      payload: {
        actorId,
        source: "deck",
        level,
        cardId: reservedCardId,
        receivedGold,
        returnTokens: payload.returnTokens ?? null,
      },
    });
  }
}

export const reserveDeckCardCommand = new ReserveDeckCardCommand();
