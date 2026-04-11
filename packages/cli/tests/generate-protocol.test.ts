import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/main.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");

describe("generate protocol", () => {
  it("writes a protocol descriptor for a game", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "tabletop-cli-protocol-"));
    const result = await run(
      [
        "generate",
        "protocol",
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
      await readFile(join(outDir, "protocol.generated.json"), "utf8"),
    ) as {
      name: string;
      commands: Record<string, unknown>;
      viewSchema: { properties: Record<string, unknown> };
    };

    expect(generated.name).toBe("splendor");
    expect(generated.commands.take_three_distinct_gems).toBeDefined();
    expect(generated.viewSchema.properties.game).toBeDefined();
  });
});
