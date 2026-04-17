import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/main.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const splendorRoot = join(repoRoot, "examples", "splendor");

describe("generate client-sdk", () => {
  it("writes a typed client sdk surface for a game", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "tabletop-cli-sdk-"));
    const result = await run(["generate", "client-sdk", "--outDir", outDir], {
      cwd: splendorRoot,
    });

    expect(result.exitCode).toBe(0);

    const generated = await readFile(
      join(outDir, "client-sdk.generated.ts"),
      "utf8",
    );

    expect(generated).toContain("export interface CanonicalState");
    expect(generated).toContain("export interface VisibleState");
    expect(generated).toContain("export type CommandRequest =");
    expect(generated).toContain("export type DiscoveryRequest =");
    expect(generated).toContain("export interface GameClientSdk");
    expect(generated).toContain("submitCommand");
    expect(generated).toContain("discover");
  });
});
