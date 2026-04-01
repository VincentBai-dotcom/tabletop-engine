import {
  GameDefinitionBuilder,
  type Command,
  type GameDefinition,
} from "tabletop-engine";
import {
  createCommands,
  type BuyFaceUpCardInput,
  type BuyReservedCardInput,
} from "./commands/index.ts";
import { createInitialGameState, setupSplendorGame } from "./setup.ts";
import type { SplendorGameState } from "./state.ts";
import { SplendorGameState as SplendorRootState } from "./state.ts";

export interface CreateSplendorGameOptions {
  playerIds: string[];
  seed?: string | number;
}

export function createSplendorGame(
  options: CreateSplendorGameOptions,
): GameDefinition<SplendorGameState, SplendorGameState> {
  const { playerIds, seed } = options;

  if (playerIds.length < 2 || playerIds.length > 4) {
    throw new Error("splendor_requires_2_to_4_players");
  }

  return new GameDefinitionBuilder<SplendorGameState>("splendor")
    .rootState(SplendorRootState)
    .rngSeed(seed)
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        completionPolicy: "after_successful_command",
        onExit: ({ command, emitEvent, game }) => {
          const actorId = command.actorId;

          if (!actorId) {
            throw new Error("actor_id_required");
          }

          game.resolveTurnEnd(actorId, emitEvent, readChosenNobleId(command));
        },
        resolveNext: ({ command, game }) => {
          const actorId = command.actorId;

          if (!actorId || game.winnerIds) {
            return {
              nextSegmentId: null,
            };
          }

          return {
            nextSegmentId: "turn",
            ownerId: game.getNextPlayerId(actorId),
          };
        },
        children: [],
      },
    })
    .initialState(() => createInitialGameState(playerIds))
    .setup(({ game, runtime, rng }) => {
      setupSplendorGame(game, runtime, rng, playerIds);
    })
    .commands(createCommands())
    .build();
}

function readChosenNobleId(command: Command): number | undefined {
  const input = command.input as
    | BuyFaceUpCardInput
    | BuyReservedCardInput
    | undefined;

  return typeof input?.chosenNobleId === "number"
    ? input.chosenNobleId
    : undefined;
}
