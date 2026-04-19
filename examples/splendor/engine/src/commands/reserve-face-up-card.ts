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

const reserveFaceUpCardCommandSchema = t.object({
  level: t.number(),
  cardId: t.number(),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

export type ReserveFaceUpCardInput =
  typeof reserveFaceUpCardCommandSchema.static;

const reserveFaceUpCardDiscoverySchema = t.object({
  selectedLevel: t.optional(t.number()),
  selectedCardId: t.optional(t.number()),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

const reserveFaceUpCardCommand = defineSplendorCommand({
  commandId: "reserve_face_up_card",
  commandSchema: reserveFaceUpCardCommandSchema,
})
  .discoverable({
    discoverySchema: reserveFaceUpCardDiscoverySchema,
    discover(context) {
      const actorId = context.actorId;
      const game = context.game;
      const draft = context.discovery.input;
      const faceUpEntries = Object.entries(game.board.faceUpByLevel) as Array<
        [string, number[]]
      >;

      if (!draft?.selectedLevel || !draft?.selectedCardId) {
        return {
          complete: false as const,
          step: SPLENDOR_DISCOVERY_STEPS.selectFaceUpCard,
          options: faceUpEntries.flatMap(([level, cardIds]) =>
            cardIds.map((cardId: number) => ({
              id: `${level}:${cardId}`,
              nextInput: {
                ...(draft ?? {}),
                selectedLevel: Number(level),
                selectedCardId: cardId,
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
        draft,
        player.tokens,
        requiredReturnCount,
      );

      return (
        returnDiscovery ??
        completeDiscovery({
          level: draft.selectedLevel,
          cardId: draft.selectedCardId,
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
      const faceUpPiles = Object.values(game.board.faceUpByLevel) as number[][];

      if (!player.canReserveMoreCards()) {
        return false;
      }

      return faceUpPiles.some((cards) => cards.length > 0);
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

      if (!game.board.faceUpByLevel[level].includes(input.cardId)) {
        return { ok: false, reason: "card_not_face_up" };
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

    player.reserveCard(input.cardId);
    game.board.removeFaceUpCard(level, input.cardId);
    game.board.replenishFaceUpCard(level);

    const receivedGold = player.gainGoldFrom(game.bank);
    player.returnTokensTo(game.bank, input.returnTokens);
    emitEvent({
      category: "domain",
      type: "card_reserved",
      payload: {
        actorId,
        source: "face_up",
        level,
        cardId: input.cardId,
        receivedGold,
        returnTokens: input.returnTokens ?? null,
      },
    });
  })
  .build();

export { reserveFaceUpCardCommand };
