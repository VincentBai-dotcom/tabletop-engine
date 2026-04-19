import { expect, test } from "bun:test";
import { createLocalSplendorSession } from "../src/session.ts";
import { renderGameScreen } from "../src/render.ts";

test("renderGameScreen includes core board sections", () => {
  const session = createLocalSplendorSession({
    seed: "render-seed",
  });
  const visibleState = session.getVisibleState();
  const screen = renderGameScreen({
    game: visibleState.game,
    activePlayerId: session.getActivePlayerId(),
    activity: session.getActivity(),
    banner: "Your turn.",
  });

  expect(screen).toContain("Splendor Terminal");
  expect(screen).toContain("Bank:");
  expect(screen).toContain("Market:");
  expect(screen).toContain("Players:");
  expect(screen).toContain("Your reserved cards:");
  expect(screen).toContain("you:");
});

test("renderGameScreen consumes visible state rather than canonical reserved cards", () => {
  const session = createLocalSplendorSession({
    seed: "render-seed",
  });

  const result = session.executeCommand(
    {
      type: "reserve_face_up_card",
      actorId: "you",
      input: {
        level: 1,
        cardId: session.getVisibleState().game.board.faceUpByLevel[1]![0]!,
      },
    },
    "You reserved a card",
  );

  expect(result.ok).toBe(true);

  const screen = renderGameScreen({
    game: session.getVisibleState().game,
    activePlayerId: session.getActivePlayerId(),
    activity: session.getActivity(),
    banner: "After reserve.",
  });

  expect(screen).toContain("Your reserved cards:");
});
