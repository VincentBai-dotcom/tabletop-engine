import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { run } from "../src/main.ts";

const projectRoot = fileURLToPath(
  new URL("./fixtures/project", import.meta.url),
);

describe("validate", () => {
  it("validates the game config from the project root", async () => {
    const result = await run(["validate"], {
      cwd: projectRoot,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("validated game:fixture-default");
  });
});
