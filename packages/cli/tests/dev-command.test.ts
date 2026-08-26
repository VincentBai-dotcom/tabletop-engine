import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FRONTEND_DEV_COMMAND,
  runDevCommand,
  type DevCommandRuntime,
} from "../src/commands/dev.ts";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(currentDir, "..", "..", "..");
const projectRoot = join(repoRoot, "examples", "splendor");

describe("tvk dev", () => {
  it("starts the frontend through npm", () => {
    expect(FRONTEND_DEV_COMMAND).toEqual({
      executable: "npm",
      args: ["run", "dev"],
    });
  });

  it("starts the server and frontend from the project config", async () => {
    let frontendRoot: string | undefined;
    let serverClosed = false;
    const output: string[] = [];

    const runtime: DevCommandRuntime = {
      startServer: async () => ({
        port: 5100,
        url: "http://localhost:5100",
        close: async () => {
          serverClosed = true;
        },
      }),
      runFrontend: async (root) => {
        frontendRoot = root;
        return 0;
      },
      emit: (line) => output.push(line),
    };

    const result = await runDevCommand([], { cwd: projectRoot }, runtime);

    expect(result.exitCode).toBe(0);
    expect(frontendRoot).toBe(join(projectRoot, "web"));
    expect(serverClosed).toBe(true);
    expect(output).toContain(
      "tvk dev server listening on http://localhost:5100",
    );
  });

  it("requires a configured frontend", async () => {
    const result = await runDevCommand([], {
      cwd: join(currentDir, "fixtures"),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("publish.frontend.root");
  });
});
