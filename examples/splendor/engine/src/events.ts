import { defineEvents, t } from "@tableverse-kit/engine";

/**
 * Splendor's declared domain events. Each payload schema both types `emitEvent`
 * (via the factory registry param) and validates the payload at runtime.
 */
export const splendorEvents = defineEvents({
  gems_taken: t.object({
    actorId: t.string(),
    colors: t.array(t.string()),
  }),
  double_gem_taken: t.object({
    actorId: t.string(),
    color: t.string(),
  }),
  card_purchased: t.object({
    actorId: t.string(),
    source: t.string(),
    cardId: t.number(),
    payment: t.record(t.string(), t.number()),
    // Present only when buying a face-up card; absent for reserved purchases.
    level: t.optional(t.number()),
  }),
  card_reserved: t.object({
    actorId: t.string(),
    source: t.string(),
    level: t.number(),
    cardId: t.number(),
    receivedGold: t.boolean(),
  }),
  noble_claimed: t.object({
    actorId: t.string(),
    nobleId: t.number(),
  }),
  tokens_returned: t.object({
    actorId: t.string(),
    returnTokens: t.record(t.string(), t.number()),
  }),
  end_game_triggered: t.object({
    actorId: t.string(),
    endsAfterPlayerId: t.string(),
  }),
  game_finished: t.object({
    winnerIds: t.optional(t.array(t.string())),
  }),
});

export type SplendorEventRegistry = typeof splendorEvents;
