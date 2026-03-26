import { GameDefinitionBuilder, type Command } from "tabletop-kernel";
import {
  createCommands,
  type SplendorCommandDefinitions,
} from "./commands/index.ts";
import { SplendorGameOps } from "./model/game-ops.ts";
import { createInitialGameState, setupSplendorGame } from "./setup.ts";
import type {
  BuyFaceUpCardPayload,
  BuyReservedCardPayload,
  SplendorGameState,
} from "./state.ts";

export interface CreateSplendorGameOptions {
  playerIds: string[];
  seed?: string | number;
}

export function createSplendorGame(options: CreateSplendorGameOptions) {
  const { playerIds, seed } = options;

  if (playerIds.length < 2 || playerIds.length > 4) {
    throw new Error("splendor_requires_2_to_4_players");
  }

  return new GameDefinitionBuilder<
    SplendorGameState,
    SplendorCommandDefinitions
  >("splendor")
    .rngSeed(seed)
    .progression({
      root: {
        id: "turn",
        kind: "turn",
        completionPolicy: "after_successful_command",
        onExit: ({ command, emitEvent, game }) => {
          const actorId = command.actorId;
          const splendorGame = game as SplendorGameState;

          if (!actorId) {
            throw new Error("actor_id_required");
          }

          const gameOps = new SplendorGameOps(splendorGame);
          gameOps.resolveTurnEnd(
            actorId,
            emitEvent,
            readChosenNobleId(command),
          );
        },
        resolveNext: ({ command, game }) => {
          const actorId = command.actorId;
          const splendorGame = game as SplendorGameState;

          if (!actorId || splendorGame.winnerIds) {
            return {
              nextSegmentId: null,
            };
          }

          const gameOps = new SplendorGameOps(splendorGame);

          return {
            nextSegmentId: "turn",
            ownerId: gameOps.getNextPlayerId(actorId),
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
  const payload = command.payload as
    | BuyFaceUpCardPayload
    | BuyReservedCardPayload
    | undefined;

  return typeof payload?.chosenNobleId === "number"
    ? payload.chosenNobleId
    : undefined;
}
