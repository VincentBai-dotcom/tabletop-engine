import { t } from "tabletop-engine";
import {
  completeDiscovery,
  createReturnTokenDiscovery,
  SPLENDOR_DISCOVERY_STEPS,
} from "../discovery.ts";
import {
  assertDevelopmentLevel,
  assertAvailableActor,
  assertActivePlayer,
  assertGameActive,
  guardedAvailability,
  guardedValidate,
  isDevelopmentLevel,
  defineSplendorCommand,
} from "./shared.ts";

const reserveFaceUpCardPayloadSchema = t.object({
  level: t.number(),
  cardId: t.number(),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

export type ReserveFaceUpCardPayload =
  typeof reserveFaceUpCardPayloadSchema.static;

const reserveFaceUpCardDraftSchema = t.object({
  selectedLevel: t.optional(t.number()),
  selectedCardId: t.optional(t.number()),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

const reserveFaceUpCardCommand = defineSplendorCommand({
  commandId: "reserve_face_up_card",
  payloadSchema: reserveFaceUpCardPayloadSchema,
  discoveryDraftSchema: reserveFaceUpCardDraftSchema,

  isAvailable(context) {
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
  },

  discover(context) {
    const actorId = assertAvailableActor(context);
    const game = context.game;
    const draft = context.discoveryInput.draft;
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
            nextDraft: {
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

  validate({ runtime, game, commandInput }) {
    return guardedValidate(() => {
      assertGameActive(game);
      const actorId = assertActivePlayer(runtime, commandInput.actorId);
      const payload = commandInput.payload;
      const player = game.getPlayer(actorId).clone();

      if (!player.canReserveMoreCards()) {
        return { ok: false, reason: "reserved_limit_reached" };
      }

      if (!payload) {
        return { ok: false, reason: "level_and_card_required" };
      }

      const level = payload.level;

      if (!isDevelopmentLevel(level)) {
        return { ok: false, reason: "invalid_level" };
      }

      if (!game.board.faceUpByLevel[level].includes(payload.cardId)) {
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
  },

  execute({ game, commandInput, emitEvent }) {
    const actorId = commandInput.actorId!;
    const payload = commandInput.payload!;
    const level = assertDevelopmentLevel(payload.level);
    const player = game.getPlayer(actorId);

    player.reserveCard(payload.cardId);
    game.board.removeFaceUpCard(level, payload.cardId);
    game.board.replenishFaceUpCard(level);

    const receivedGold = player.gainGoldFrom(game.bank);
    player.returnTokensTo(game.bank, payload.returnTokens);
    emitEvent({
      category: "domain",
      type: "card_reserved",
      payload: {
        actorId,
        source: "face_up",
        level,
        cardId: payload.cardId,
        receivedGold,
        returnTokens: payload.returnTokens ?? null,
      },
    });
  },
});

export { reserveFaceUpCardCommand };
