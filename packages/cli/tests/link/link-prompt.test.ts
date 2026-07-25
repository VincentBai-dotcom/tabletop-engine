import { select } from "@inquirer/prompts";
import { render } from "@inquirer/testing";
import { describe, expect, it } from "vitest";
import { buildLinkChoices } from "../../src/lib/link/link-prompt.ts";
import type { GameResponse } from "../../src/lib/api/games.ts";

function game(id: string, name: string): GameResponse {
  return {
    id,
    name,
    urlName: null,
    currentVersionNumber: null,
    createdAt: "t",
    updatedAt: "t",
  };
}

describe("buildLinkChoices", () => {
  it("puts create first, then one row per game with its id", () => {
    const choices = buildLinkChoices([game("g1", "One"), game("g2", "Two")]);

    expect(choices.map((c) => c.name)).toEqual([
      "Create a new game",
      "One (g1)",
      "Two (g2)",
    ]);
    expect(choices[0]!.value).toEqual({ kind: "create" });
    expect(choices[2]!.value).toEqual({ kind: "pick", gameId: "g2" });
  });
});

describe("link select navigation", () => {
  it("moves the highlight with the down arrow and resolves the row at Enter", async () => {
    const choices = buildLinkChoices([game("g1", "One"), game("g2", "Two")]);
    const { answer, events, getScreen } = await render(select, {
      message: "Choose one:",
      choices,
    });

    // The first row (Create a new game) is highlighted on open.
    expect(getScreen()).toContain("Create a new game");

    events.keypress("down"); // -> One
    events.keypress("down"); // -> Two
    events.keypress("enter");

    await expect(answer).resolves.toEqual({ kind: "pick", gameId: "g2" });
  });

  it("selects create when Enter is pressed on the first row", async () => {
    const choices = buildLinkChoices([game("g1", "One")]);
    const { answer, events } = await render(select, {
      message: "Choose one:",
      choices,
    });

    events.keypress("enter");

    await expect(answer).resolves.toEqual({ kind: "create" });
  });
});
