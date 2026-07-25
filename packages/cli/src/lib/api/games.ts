import { Type, type Static } from "@sinclair/typebox";

/**
 * `GET /games/:gameId` and each element of `GET /games`. Identity is `id`;
 * `name` is display text `tvk upload` prints so a wrong target is visible before
 * packaging. `currentVersionNumber` is null until a build first reaches ready.
 */
export const GameResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  urlName: Type.Union([Type.String(), Type.Null()]),
  currentVersionNumber: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export type GameResponse = Static<typeof GameResponseSchema>;

/** `GET /games` — the account's games, newest first, for the link picker. */
export const ListGamesResponseSchema = Type.Object({
  games: Type.Array(GameResponseSchema),
});

export type ListGamesResponse = Static<typeof ListGamesResponseSchema>;
