import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import {
  GameLinkError,
  resolveGameLink,
  writeGameLink,
} from "../../src/lib/link/game-link.ts";

const dirs: string[] = [];

async function tempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tvk-link-"));
  dirs.push(dir);
  return dir;
}

async function writeLink(cwd: string, contents: string): Promise<void> {
  await mkdir(join(cwd, ".tableverse"), { recursive: true });
  await writeFile(join(cwd, ".tableverse", "game.json"), contents);
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true })));
});

describe("resolveGameLink", () => {
  it("returns null for a directory with no link and no override", async () => {
    const cwd = await tempProject();

    expect(await resolveGameLink({ cwd, env: {} })).toBeNull();
  });

  it("reads the gameId from .tableverse/game.json", async () => {
    const cwd = await tempProject();
    await writeLink(cwd, JSON.stringify({ gameId: "game-123" }));

    expect(await resolveGameLink({ cwd, env: {} })).toEqual({
      gameId: "game-123",
      source: "file",
    });
  });

  it("lets TABLEVERSE_GAME_ID override the file", async () => {
    const cwd = await tempProject();
    await writeLink(cwd, JSON.stringify({ gameId: "from-file" }));

    expect(
      await resolveGameLink({ cwd, env: { TABLEVERSE_GAME_ID: "from-env" } }),
    ).toEqual({ gameId: "from-env", source: "env" });
  });

  it("uses the override when there is no file at all", async () => {
    const cwd = await tempProject();

    expect(
      await resolveGameLink({ cwd, env: { TABLEVERSE_GAME_ID: "from-env" } }),
    ).toEqual({ gameId: "from-env", source: "env" });
  });

  it("treats a malformed link file as an error, not an unlinked directory", async () => {
    const cwd = await tempProject();
    await writeLink(cwd, "{ not json");

    await expect(resolveGameLink({ cwd, env: {} })).rejects.toBeInstanceOf(
      GameLinkError,
    );
  });

  it("errors when the link file has no gameId", async () => {
    const cwd = await tempProject();
    await writeLink(cwd, JSON.stringify({ notGameId: "x" }));

    await expect(resolveGameLink({ cwd, env: {} })).rejects.toBeInstanceOf(
      GameLinkError,
    );
  });
});

describe("writeGameLink", () => {
  it("writes a link resolveGameLink reads back, creating .tableverse", async () => {
    const cwd = await tempProject();

    await writeGameLink({ cwd, gameId: "game-xyz" });

    expect(await resolveGameLink({ cwd, env: {} })).toEqual({
      gameId: "game-xyz",
      source: "file",
    });
  });

  it("overwrites an existing link on re-link", async () => {
    const cwd = await tempProject();
    await writeGameLink({ cwd, gameId: "first" });
    await writeGameLink({ cwd, gameId: "second" });

    expect(await resolveGameLink({ cwd, env: {} })).toMatchObject({
      gameId: "second",
    });
  });
});
