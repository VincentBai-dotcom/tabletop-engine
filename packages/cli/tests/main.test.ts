import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { run } from "../src/main.ts";

describe("tvk", () => {
  // `bin` points at the TypeScript entry with no build step, so `node` runs it
  // through type stripping. That only works while the CLI stays inside
  // strip-only syntax — no constructor parameter properties, no enums, no
  // namespaces — since stripping erases types without transforming them.
  it("is executable by bare node, the runtime this repo ships", async () => {
    const mainSource = readFileSync(
      new URL("../src/main.ts", import.meta.url),
      "utf8",
    );

    expect(mainSource.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });

  it("prints top-level help for --help", async () => {
    const result = await run(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("tvk");
    expect(result.stdout).toContain("validate");
  });

  it("prints validate help for validate --help", async () => {
    const result = await run(["validate", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("tvk validate");
    expect(result.stdout).toContain("--config");
  });

  it("rejects deprecated game-selection flags", async () => {
    const result = await run([
      "validate",
      "--game",
      "packages/cli/tests/fixtures/game-default.ts",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("deprecated_flag:--game");
  });

  it("rejects unexpected positional arguments after command parsing begins", async () => {
    const result = await run(["validate", "oops"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unexpected_positional_argument:oops");
  });
});
