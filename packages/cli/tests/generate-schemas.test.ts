import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/main.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");

describe("generate schemas", () => {
  it("writes schema artifacts for a game", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "tabletop-cli-schemas-"));
    const result = await run(
      [
        "generate",
        "schemas",
        "--game",
        "examples/splendor/src/game.ts",
        "--export",
        "createSplendorGame",
        "--outDir",
        outDir,
      ],
      {
        cwd: repoRoot,
      },
    );

    expect(result.exitCode).toBe(0);

    const generated = JSON.parse(
      await readFile(join(outDir, "schemas.generated.json"), "utf8"),
    ) as {
      canonicalState: { properties: Record<string, unknown> };
      visibleState: { properties: Record<string, unknown> };
      commands: Record<string, unknown>;
      discoveries: Record<string, unknown>;
    };

    expect(generated.canonicalState.properties.game).toBeDefined();
    expect(generated.canonicalState.properties.runtime).toBeDefined();
    expect(generated.visibleState.properties.game).toBeDefined();
    expect(generated.visibleState.properties.progression).toBeDefined();
    expect(generated.commands.take_three_distinct_gems).toBeDefined();
    expect(generated.discoveries.take_three_distinct_gems).toBeDefined();
    expect(generated.discoveries.take_three_distinct_gems).toMatchObject({
      type: "object",
    });
    expect(generated.discoveries.take_three_distinct_gems).not.toHaveProperty(
      "kind",
    );
  });
});
