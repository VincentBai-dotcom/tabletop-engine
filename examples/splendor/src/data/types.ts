export const GEM_COLORS = ["Black", "Blue", "Green", "Red", "White"] as const;

export type GemColor = (typeof GEM_COLORS)[number];

export const DEVELOPMENT_LEVELS = [1, 2, 3] as const;

export type DevelopmentLevel = (typeof DEVELOPMENT_LEVELS)[number];

export interface CardCost {
  readonly Black: number;
  readonly Blue: number;
  readonly Green: number;
  readonly Red: number;
  readonly White: number;
}

export interface DevelopmentCard {
  readonly id: number;
  readonly level: DevelopmentLevel;
  readonly bonusColor: GemColor;
  readonly prestigePoints: number;
  readonly cost: CardCost;
}

export interface NobleTile {
  readonly id: number;
  readonly name: string;
  readonly requirements: CardCost;
}
