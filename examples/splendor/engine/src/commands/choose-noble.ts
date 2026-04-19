import { t } from "tabletop-engine";
import { completeDiscovery, createNobleDiscovery } from "../discovery.ts";
import {
  defineSplendorCommand,
  guardedAvailability,
  guardedValidate,
} from "./shared.ts";

const chooseNobleCommandSchema = t.object({
  nobleId: t.number(),
});

export type ChooseNobleInput = typeof chooseNobleCommandSchema.static;

const chooseNobleDiscoverySchema = t.object({
  chosenNobleId: t.optional(t.number()),
});

const chooseNobleCommand = defineSplendorCommand({
  commandId: "choose_noble",
  commandSchema: chooseNobleCommandSchema,
})
  .discoverable({
    discoverySchema: chooseNobleDiscoverySchema,
    discover(context) {
      const actorId = context.actorId;
      const player = context.game.getPlayer(actorId);
      const draft = context.discovery.input;
      const eligibleNobles = context.game.getEligibleNobles(player);
      const nobleDiscovery = createNobleDiscovery(draft, eligibleNobles);

      return (
        nobleDiscovery ??
        completeDiscovery({
          nobleId: draft.chosenNobleId!,
        })
      );
    },
  })
  .isAvailable((context) => {
    return guardedAvailability(() => {
      const actorId = context.actorId;
      const player = context.game.getPlayer(actorId);

      return context.game.getEligibleNobles(player).length > 1;
    });
  })
  .validate(({ game, command }) => {
    return guardedValidate(() => {
      const actorId = command.actorId;
      const player = game.getPlayer(actorId);
      const eligibleNobles = game.getEligibleNobles(player);

      if (eligibleNobles.length <= 1) {
        return { ok: false, reason: "noble_choice_not_required" };
      }

      if (!eligibleNobles.some((noble) => noble.id === command.input.nobleId)) {
        return { ok: false, reason: "invalid_chosen_noble" };
      }

      return { ok: true };
    });
  })
  .execute(({ game, command, emitEvent }) => {
    const actorId = command.actorId;
    const player = game.getPlayer(actorId);
    const claimedNobleId = game.resolveNobleVisit(
      player,
      command.input.nobleId,
    );

    if (claimedNobleId === null) {
      throw new Error("noble_choice_not_required");
    }

    emitEvent({
      category: "domain",
      type: "noble_claimed",
      payload: {
        actorId,
        nobleId: claimedNobleId,
      },
    });
  })
  .build();

export { chooseNobleCommand };
