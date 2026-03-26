import type { CommandDefinition } from "tabletop-kernel";
import type { SplendorGameState } from "../state.ts";
import { buyFaceUpCardCommand } from "./buy-face-up-card.ts";
import { buyReservedCardCommand } from "./buy-reserved-card.ts";
import { reserveDeckCardCommand } from "./reserve-deck-card.ts";
import { reserveFaceUpCardCommand } from "./reserve-face-up-card.ts";
import { takeThreeDistinctGemsCommand } from "./take-three-distinct-gems.ts";
import { takeTwoSameGemsCommand } from "./take-two-same-gems.ts";

export type SplendorCommandDefinition = CommandDefinition<SplendorGameState>;

export function createCommands(): SplendorCommandDefinition[] {
  return [
    takeThreeDistinctGemsCommand,
    takeTwoSameGemsCommand,
    reserveFaceUpCardCommand,
    reserveDeckCardCommand,
    buyFaceUpCardCommand,
    buyReservedCardCommand,
  ];
}
