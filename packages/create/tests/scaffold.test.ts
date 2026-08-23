import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { scaffold } from "../src/scaffold.ts";
import { run } from "../src/main.ts";

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "tvk-create-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

describe("scaffold", () => {
  test("emits template files with underscore-prefixed names restored", async () => {
    const target = join(workspace, "game");
    await scaffold({
      targetDir: target,
      projectName: "my-game",
      tableverseVersion: "^1.2.3",
    });

    const names = (await collectFiles(target)).map((path) =>
      path.slice(target.length + 1),
    );

    expect(names).toContain("package.json");
    expect(names).toContain(".gitignore");
    expect(names).toContain("engine/package.json");
    expect(names).toContain("engine/tsconfig.json");
    expect(names).toContain("engine/src/game.ts");
    expect(names).toContain("client/package.json");
    expect(names).toContain("client/tsconfig.json");
    expect(names).toContain("client/src/main.ts");
    expect(names).not.toContain("_package.json");
    expect(names).not.toContain("_gitignore");
    expect(names).not.toContain("engine/_tsconfig.json");
  });

  test("substitutes the project name and version tokens", async () => {
    const target = join(workspace, "game");
    await scaffold({
      targetDir: target,
      projectName: "my-game",
      tableverseVersion: "^1.2.3",
    });

    const rootManifest = JSON.parse(
      await readFile(join(target, "package.json"), "utf8"),
    );
    expect(rootManifest.name).toBe("my-game");
    expect(rootManifest.devDependencies["@tableverse-kit/cli"]).toBe("^1.2.3");

    const clientManifest = JSON.parse(
      await readFile(join(target, "client", "package.json"), "utf8"),
    );
    expect(clientManifest.name).toBe("my-game-client");
    expect(clientManifest.dependencies["my-game-engine"]).toBe("workspace:*");
  });

  test("creates one client that selects its connection", async () => {
    const target = join(workspace, "game");
    await scaffold({
      targetDir: target,
      projectName: "my-game",
      tableverseVersion: "^1.2.3",
    });

    const clientSource = await readFile(
      join(target, "client", "src", "main.ts"),
      "utf8",
    );
    expect(clientSource).toContain("createTableverseClient<Game>()");
    expect(clientSource).not.toContain("createDevClient");
    expect(clientSource).not.toContain("createBridgeClient");
    expect(clientSource).not.toContain("import.meta.env");
  });

  test("leaves no unresolved placeholder tokens", async () => {
    const target = join(workspace, "game");
    await scaffold({
      targetDir: target,
      projectName: "my-game",
      tableverseVersion: "^1.2.3",
    });

    for (const path of await collectFiles(target)) {
      const contents = await readFile(path, "utf8");
      expect(contents).not.toContain("{{");
    }
  });
});

describe("run", () => {
  test("scaffolds into a named directory and derives the project slug", async () => {
    const result = await run([join(workspace, "My Cool Game")]);

    expect(result.exitCode).toBe(0);
    const manifest = JSON.parse(
      await readFile(join(workspace, "My Cool Game", "package.json"), "utf8"),
    );
    expect(manifest.name).toBe("my-cool-game");
  });

  test("refuses a non-empty target directory", async () => {
    const target = join(workspace, "occupied");
    await run([target]);

    const second = await run([target]);
    expect(second.exitCode).toBe(1);
    expect(second.stderr).toContain("directory_not_empty");
  });

  test("prints usage and fails when no directory is given", async () => {
    const result = await run([]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage");
  });
});
