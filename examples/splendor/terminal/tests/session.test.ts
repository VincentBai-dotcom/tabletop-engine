import { expect, test } from "bun:test";
import { createLocalSplendorSession } from "../src/session.ts";

test("local splendor session exposes the current active player from stage runtime", () => {
  const session = createLocalSplendorSession({
    seed: "session-seed",
  });

  expect(session.getActivePlayerId()).toBe("you");
});

test("local splendor session exposes player-visible state only", () => {
  const session = createLocalSplendorSession({
    seed: "session-seed",
  });

  const visibleState = session.getVisibleState();

  expect(visibleState.game.board.deckByLevel).toMatchObject({
    __hidden: true,
    value: {
      1: expect.any(Number),
      2: expect.any(Number),
      3: expect.any(Number),
    },
  });
});

test("failed commands do not overwrite recent activity summary", () => {
  const session = createLocalSplendorSession({
    seed: "session-seed",
  });

  const result = session.executeCommand(
    {
      type: "take_three_distinct_gems",
      actorId: "bot-1",
      input: {
        colors: ["white", "blue", "green"],
      },
    },
    "bot-1 took gems",
  );

  expect(result.ok).toBe(false);
  expect(session.getActivity()).toMatchObject({
    command: null,
    summary: null,
    error: "not_active_player",
  });
});
