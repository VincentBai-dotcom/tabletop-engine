import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { createGenerationContext } from "../src/lib/generation-context.ts";
import { loadGame } from "../src/lib/load-game.ts";
import { parseCommandArguments } from "../src/lib/parse-args.ts";

const repoRoot = resolve(import.meta.dir, "..", "..", "..");

describe("loadGame", () => {
  it("loads a game from a default export factory", async () => {
    const game = await loadGame({
      gamePath: resolve(import.meta.dir, "fixtures/game-default.ts"),
      cwd: repoRoot,
    });

    expect(game.name).toBe("fixture-default");
  });

  it("loads a game from an explicit named export factory", async () => {
    const game = await loadGame({
      gamePath: resolve(import.meta.dir, "fixtures/game-named.ts"),
      exportName: "createFixtureGame",
      cwd: repoRoot,
    });

    expect(game.name).toBe("fixture-named");
  });

  it("loads a game from the splendor example with default cli options", async () => {
    const game = await loadGame({
      gamePath: resolve(repoRoot, "examples/splendor/src/game.ts"),
      exportName: "createSplendorGame",
      cwd: repoRoot,
    });

    expect(game.name).toBe("splendor");
  });

  it("fails when the requested export is not a game", async () => {
    await expect(
      loadGame({
        gamePath: resolve(import.meta.dir, "fixtures/game-invalid.ts"),
        exportName: "notAGame",
        cwd: repoRoot,
      }),
    ).rejects.toThrow("invalid_game_export:notAGame");
  });
});

describe("createGenerationContext", () => {
  it("resolves the output directory from command arguments", async () => {
    const parsed = parseCommandArguments([
      "--game",
      "examples/splendor/src/game.ts",
      "--export",
      "createSplendorGame",
      "--outDir",
      "/tmp/tabletop-cli-tests",
    ]);

    const context = await createGenerationContext(parsed, {
      cwd: repoRoot,
    });

    expect(context.game.name).toBe("splendor");
    expect(context.outputDirectory).toBe("/tmp/tabletop-cli-tests");
    expect(
      context.gameModulePath.endsWith("examples/splendor/src/game.ts"),
    ).toBe(true);
  });
});
