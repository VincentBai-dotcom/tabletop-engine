import { describe, expect, it } from "bun:test";
import { run } from "../src/main.ts";

describe("tabletop-cli", () => {
  it("prints top-level help for --help", async () => {
    const result = await run(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("tabletop-cli");
    expect(result.stdout).toContain("generate");
    expect(result.stdout).toContain("validate");
  });
});
