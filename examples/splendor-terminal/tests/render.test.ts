import { expect, test } from "bun:test";
import { createLocalSplendorSession } from "../src/session.ts";
import { renderGameScreen } from "../src/render.ts";

test("renderGameScreen includes core board sections", () => {
  const session = createLocalSplendorSession({
    seed: "render-seed",
  });
  const screen = renderGameScreen({
    game: session.getState().game,
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
