import type { CommandDefinition } from "tabletop-kernel";
import type { SplendorGameState } from "../state.ts";
import {
  BuyFaceUpCardCommand,
  buyFaceUpCardCommand,
} from "./buy-face-up-card.ts";
import {
  BuyReservedCardCommand,
  buyReservedCardCommand,
} from "./buy-reserved-card.ts";
import {
  ReserveDeckCardCommand,
  reserveDeckCardCommand,
} from "./reserve-deck-card.ts";
import {
  ReserveFaceUpCardCommand,
  reserveFaceUpCardCommand,
} from "./reserve-face-up-card.ts";
import {
  TakeThreeDistinctGemsCommand,
  takeThreeDistinctGemsCommand,
} from "./take-three-distinct-gems.ts";
import {
  TakeTwoSameGemsCommand,
  takeTwoSameGemsCommand,
} from "./take-two-same-gems.ts";

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

export {
  BuyFaceUpCardCommand,
  BuyReservedCardCommand,
  ReserveDeckCardCommand,
  ReserveFaceUpCardCommand,
  TakeThreeDistinctGemsCommand,
  TakeTwoSameGemsCommand,
};
