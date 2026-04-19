import { t } from "tabletop-engine";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import {
  assertDevelopmentLevel,
  guardedAvailability,
  guardedValidate,
  isDevelopmentLevel,
  defineSplendorCommand,
} from "./shared.ts";

const reserveDeckCardCommandSchema = t.object({
  level: t.number(),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

export type ReserveDeckCardInput = typeof reserveDeckCardCommandSchema.static;

const reserveDeckCardDiscoverySchema = t.object({
  selectedLevel: t.optional(t.number()),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

const reserveDeckCardCommand = defineSplendorCommand({
  commandId: "reserve_deck_card",
  commandSchema: reserveDeckCardCommandSchema,
})
  .discoverable({
    discoverySchema: reserveDeckCardDiscoverySchema,
    discover(context) {
      const actorId = context.actorId;
      const game = context.game;
      const draft = context.discovery.input;
      const deckEntries = Object.entries(game.board.deckByLevel) as Array<
        [string, number[]]
      >;

      if (!draft?.selectedLevel) {
        return {
          complete: false as const,
          step: SPLENDOR_DISCOVERY_STEPS.selectDeckLevel,
          options: deckEntries
            .filter(([, cardIds]) => cardIds.length > 0)
            .map(([level]) => ({
              id: level,
              nextInput: {
                ...(draft ?? {}),
                selectedLevel: Number(level),
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
        draft,
        player.tokens,
        requiredReturnCount,
      );

      return (
        returnDiscovery ??
        completeDiscovery({
          level: draft.selectedLevel,
          returnTokens: draft.returnTokens,
        })
      );
    },
  })
  .isAvailable((context) => {
    return guardedAvailability(() => {
      const actorId = context.actorId;
      const game = context.game;
      const player = game.getPlayer(actorId);
      const decks = Object.values(game.board.deckByLevel) as number[][];

      if (!player.canReserveMoreCards()) {
        return false;
      }

      return decks.some((cards) => cards.length > 0);
    });
  })
  .validate(({ game, command }) => {
    return guardedValidate(() => {
      const actorId = command.actorId;
      const input = command.input;
      const player = game.getPlayer(actorId).clone();

      if (!player.canReserveMoreCards()) {
        return { ok: false, reason: "reserved_limit_reached" };
      }

      const level = input.level;

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
          input.returnTokens,
          player.getRequiredReturnCount(),
        )
      ) {
        return { ok: false, reason: "invalid_return_tokens" };
      }

      return { ok: true };
    });
  })
  .execute(({ game, command, emitEvent }) => {
    const actorId = command.actorId;
    const input = command.input;
    const level = assertDevelopmentLevel(input.level);
    const player = game.getPlayer(actorId);
    const reservedCardId = game.board.reserveDeckCard(level);

    player.reserveCard(reservedCardId);
    const receivedGold = player.gainGoldFrom(game.bank);
    player.returnTokensTo(game.bank, input.returnTokens);
    emitEvent({
      category: "domain",
      type: "card_reserved",
      payload: {
        actorId,
        source: "deck",
        level,
        cardId: reservedCardId,
        receivedGold,
        returnTokens: input.returnTokens ?? null,
      },
    });
  })
  .build();

export { reserveDeckCardCommand };
