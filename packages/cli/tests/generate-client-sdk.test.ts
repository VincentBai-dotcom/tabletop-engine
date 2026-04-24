import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "../src/main.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");

async function writeCliConfig(cwd: string): Promise<void> {
  const configFile = join(cwd, "tabletop.config.ts");
  const configSource = [
    `import { defineConfig } from ${JSON.stringify(
      pathToFileURL(
        join(repoRoot, "packages", "tabletop-engine", "src", "config.ts"),
      ).href,
    )};`,
    `import { t } from ${JSON.stringify(
      pathToFileURL(
        join(repoRoot, "packages", "tabletop-engine", "src", "index.ts"),
      ).href,
    )};`,
    "",
    "export default defineConfig({",
    "  game: {",
    '    name: "cli-fixture",',
    "    canonicalGameStateSchema: t.object({",
    "      score: t.number(),",
    "    }),",
    "    runtimeStateSchema: t.object({",
    "      phase: t.string(),",
    "    }),",
    "    commands: {",
    "      take_three_distinct_gems: {",
    '        commandId: "take_three_distinct_gems",',
    "        commandSchema: t.object({",
    "          colors: t.array(t.string()),",
    "        }),",
    "        discovery: {",
    '          startStep: "confirm_selection",',
    "          steps: [",
    "            {",
    '              stepId: "select_gems",',
    "              inputSchema: t.object({",
    "              }),",
    "              outputSchema: t.object({",
    "                label: t.string(),",
    "                amount: t.number(),",
    "              }),",
    "              resolve: () => [],",
    "            },",
    "            {",
    '              stepId: "confirm_selection",',
    "              inputSchema: t.object({",
    "              }),",
    "              outputSchema: t.object({",
    "                ready: t.boolean(),",
    "              }),",
    "              resolve: () => [],",
    "            },",
    "          ],",
    "        },",
    "      },",
    "      seeded_target: {",
    '        commandId: "seeded_target",',
    "        commandSchema: t.object({",
    "          targetId: t.string(),",
    "        }),",
    "        discovery: {",
    '          startStep: "select_target",',
    "          steps: [",
    "            {",
    '              stepId: "select_target",',
    "              inputSchema: t.object({",
    "                seed: t.string(),",
    "              }),",
    "              outputSchema: t.object({",
    "                targetId: t.string(),",
    "              }),",
    "              resolve: () => [],",
    "            },",
    "          ],",
    "        },",
    "      },",
    "    },",
    "  },",
    "});",
    "",
  ].join("\n");

  await writeFile(configFile, configSource, "utf8");
}

describe("generate client-sdk", () => {
  it("writes a typed client sdk surface for a game", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "tabletop-cli-sdk-"));
    await writeCliConfig(cwd);

    const result = await run(
      ["generate", "client-sdk", "--outDir", "generated"],
      {
        cwd,
      },
    );

    expect(result.exitCode).toBe(0);

    const generated = await readFile(
      join(cwd, "generated", "client-sdk.generated.ts"),
      "utf8",
    );

    expect(generated).toContain("export interface VisibleState");
    expect(generated).toContain(
      "export type TakeThreeDistinctGemsCommandRequest =",
    );
    expect(generated).toContain(
      "export type TakeThreeDistinctGemsDiscoveryRequest =",
    );
    expect(generated).toContain(
      "export type TakeThreeDistinctGemsDiscoveryResult =",
    );
    expect(generated).toContain(
      "export type TakeThreeDistinctGemsDiscoveryStart =",
    );
    expect(generated).toContain(
      "export const takeThreeDistinctGemsDiscoveryStart =",
    );
    expect(generated).toContain('step: "confirm_selection"');
    expect(generated).toContain(
      'export type TakeThreeDistinctGemsDiscoveryStart = Omit<Extract<TakeThreeDistinctGemsDiscoveryRequest, { step: "confirm_selection" }>, "actorId">;',
    );
    expect(generated).toContain("export type SeededTargetDiscoveryStart =");
    expect(generated).not.toContain(
      "export const seededTargetDiscoveryStart =",
    );
    expect(generated).toContain("export type CommandRequest =");
    expect(generated).toContain("export type DiscoveryRequest =");
    expect(generated).toContain("export type DiscoveryResult =");
    expect(generated).toContain("step:");
    expect(generated).toContain("output:");
    expect(generated).toContain("nextStep:");
    expect(generated).toContain("nextInput:");
    expect(generated).not.toContain("GameClientSdk");
    expect(generated).not.toContain("submitCommand");
    expect(generated).not.toContain("discover(");
  });
});
