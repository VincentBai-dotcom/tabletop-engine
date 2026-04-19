export const TOKEN_COLORS = [
  "white",
  "blue",
  "green",
  "red",
  "black",
  "gold",
] as const;

export const GEM_TOKEN_COLORS = TOKEN_COLORS.filter(
  (color) => color !== "gold",
) as readonly GemTokenColor[];

export type TokenColor = (typeof TOKEN_COLORS)[number];
export type GemTokenColor = Exclude<TokenColor, "gold">;
