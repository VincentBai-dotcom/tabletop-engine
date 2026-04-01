import { expect, test } from "bun:test";
import { createLocalSplendorSession } from "../src/session.ts";

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
