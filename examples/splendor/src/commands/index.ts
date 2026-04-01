import { buyFaceUpCardCommand } from "./buy-face-up-card.ts";
import { buyReservedCardCommand } from "./buy-reserved-card.ts";
import { reserveDeckCardCommand } from "./reserve-deck-card.ts";
import { reserveFaceUpCardCommand } from "./reserve-face-up-card.ts";
import { takeThreeDistinctGemsCommand } from "./take-three-distinct-gems.ts";
import { takeTwoSameGemsCommand } from "./take-two-same-gems.ts";
import type { SplendorCommand } from "./shared.ts";

export function createCommands(): SplendorCommand[] {
  return [
    takeThreeDistinctGemsCommand,
    takeTwoSameGemsCommand,
    reserveFaceUpCardCommand,
    reserveDeckCardCommand,
    buyFaceUpCardCommand,
    buyReservedCardCommand,
  ];
}

export type { BuyFaceUpCardPayload } from "./buy-face-up-card.ts";
export type { BuyReservedCardPayload } from "./buy-reserved-card.ts";
export type { ReserveDeckCardPayload } from "./reserve-deck-card.ts";
export type { ReserveFaceUpCardPayload } from "./reserve-face-up-card.ts";
export type { TakeThreeDistinctGemsPayload } from "./take-three-distinct-gems.ts";
export type { TakeTwoSameGemsPayload } from "./take-two-same-gems.ts";
