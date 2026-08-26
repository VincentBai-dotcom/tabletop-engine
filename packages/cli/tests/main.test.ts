import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { run } from "../src/main.ts";

describe("tvk", () => {
  it("loads the TypeScript entry through tsx", () => {
    const launcher = readFileSync(
      new URL("../bin/tvk.js", import.meta.url),
      "utf8",
    );

    expect(launcher.startsWith("#!/usr/bin/env node\n")).toBe(true);
    expect(launcher).toContain('import "tsx";');
    expect(launcher).toContain('import("../src/main.ts")');
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
  });

  it("rejects unexpected positional arguments after command parsing begins", async () => {
    const result = await run(["validate", "oops"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unexpected_positional_argument:oops");
  });
});
