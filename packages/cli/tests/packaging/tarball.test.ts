import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { list as tarList } from "tar";
import {
  packSource,
  SourcePackagingError,
} from "../../src/lib/packaging/tarball.ts";

const dirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tvk-pack-"));
  dirs.push(dir);
  return dir;
}

async function write(dir: string, rel: string, body = "x"): Promise<void> {
  const target = join(dir, rel);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, body);
}

async function entriesOf(tarPath: string): Promise<string[]> {
  const names: string[] = [];
  await tarList({ file: tarPath, onentry: (e) => names.push(e.path) });
  return names.sort();
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true })));
});

describe("packSource", () => {
  it("packs the source tree and reports a stable digest and size", async () => {
    const root = await tempDir();
    await write(root, "package.json", "{}");
    await write(root, "src/index.ts", "export const x = 1;");

    const out = join(await tempDir(), "engine.tar.gz");
    const packaged = await packSource({ root, outFile: out });

    expect(packaged.fileCount).toBe(2);
    expect(packaged.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(packaged.sizeBytes).toBeGreaterThan(0);
    expect(await entriesOf(out)).toEqual(["package.json", "src/index.ts"]);
  });

  it("excludes node_modules and .git", async () => {
    const root = await tempDir();
    await write(root, "package.json", "{}");
    await write(root, "node_modules/dep/index.js");
    await write(root, ".git/HEAD");

    const out = join(await tempDir(), "engine.tar.gz");
    await packSource({ root, outFile: out });

    expect(await entriesOf(out)).toEqual(["package.json"]);
  });

  it("excludes a caller-supplied build output directory", async () => {
    const root = await tempDir();
    await write(root, "package.json", "{}");
    await write(root, "dist/bundle.js");

    const out = join(await tempDir(), "web.tar.gz");
    await packSource({ root, outFile: out, excludeDirs: ["dist"] });

    expect(await entriesOf(out)).toEqual(["package.json"]);
  });

  it.each(["./dist", "dist/", "./dist/"])(
    "excludes a build output directory written as %s",
    async (spelling) => {
      const root = await tempDir();
      await write(root, "package.json", "{}");
      await write(root, "dist/bundle.js");

      const out = join(await tempDir(), "web.tar.gz");
      await packSource({ root, outFile: out, excludeDirs: [spelling] });

      expect(await entriesOf(out)).toEqual(["package.json"]);
    },
  );

  it("drops a local .env from the tarball but still publishes", async () => {
    const root = await tempDir();
    await write(root, "package.json", "{}");
    await write(root, ".env", "SECRET=1");
    await write(root, "src/index.ts", "export const x = 1;");

    const out = join(await tempDir(), "engine.tar.gz");
    const packaged = await packSource({ root, outFile: out });

    expect(packaged.droppedFiles).toEqual([".env"]);
    expect(await entriesOf(out)).toEqual(["package.json", "src/index.ts"]);
  });

  it("refuses when the tree carries credential material", async () => {
    const root = await tempDir();
    await write(root, "package.json", "{}");
    await write(root, "server.pem", "-----BEGIN PRIVATE KEY-----");

    const out = join(await tempDir(), "engine.tar.gz");
    await expect(packSource({ root, outFile: out })).rejects.toMatchObject({
      reason: "secret_files",
      files: ["server.pem"],
    });
  });

  it("refuses a tree that is only a dropped env file", async () => {
    const root = await tempDir();
    await write(root, ".env", "SECRET=1");

    const out = join(await tempDir(), "engine.tar.gz");
    await expect(packSource({ root, outFile: out })).rejects.toMatchObject({
      reason: "empty_source",
    });
  });

  it("refuses an empty source tree", async () => {
    const root = await tempDir();

    const out = join(await tempDir(), "engine.tar.gz");
    await expect(packSource({ root, outFile: out })).rejects.toBeInstanceOf(
      SourcePackagingError,
    );
  });
});
