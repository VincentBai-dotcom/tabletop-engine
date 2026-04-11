import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameExecutor } from "tabletop-engine";
import { createSplendorGame } from "splendor-example";
import { run } from "../src/main.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");

describe("validate", () => {
  it("validates a game definition when given only the game module", async () => {
    const result = await run(
      [
        "validate",
        "--game",
        "examples/splendor/src/game.ts",
        "--export",
        "createSplendorGame",
      ],
      {
        cwd: repoRoot,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("validated game:splendor");
  });

  it("validates a valid snapshot", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "tabletop-cli-validate-"));
    const game = createSplendorGame({
      playerIds: ["player-1", "player-2"],
    });
    const executor = createGameExecutor(game);
    const snapshotPath = join(outDir, "snapshot.json");

    await writeFile(
      snapshotPath,
      JSON.stringify(executor.createInitialState(), null, 2),
      "utf8",
    );

    const result = await run(
      [
        "validate",
        "--game",
        "examples/splendor/src/game.ts",
        "--export",
        "createSplendorGame",
        "--snapshot",
        snapshotPath,
      ],
      {
        cwd: repoRoot,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("validated snapshot");
  });

  it("fails for an invalid snapshot", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "tabletop-cli-validate-"));
    const game = createSplendorGame({
      playerIds: ["player-1", "player-2"],
    });
    const executor = createGameExecutor(game);
    const invalidSnapshotPath = join(outDir, "invalid-snapshot.json");
    const invalidState = executor.createInitialState();

    invalidState.game.playerOrder = 123 as never;

    await writeFile(
      invalidSnapshotPath,
      JSON.stringify(invalidState, null, 2),
      "utf8",
    );

    const result = await run(
      [
        "validate",
        "--game",
        "examples/splendor/src/game.ts",
        "--export",
        "createSplendorGame",
        "--snapshot",
        invalidSnapshotPath,
      ],
      {
        cwd: repoRoot,
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("invalid_schema_value");
    expect(await readFile(invalidSnapshotPath, "utf8")).toContain("123");
  });
});
