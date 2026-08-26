import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { create as tarCreate } from "tar";
import { ALWAYS_EXCLUDED_DIRS, classifyFile } from "./secrets.ts";

export interface PackagedSource {
  path: string;
  sha256: string;
  sizeBytes: number;
  fileCount: number;
  droppedFiles: string[];
}

export class SourcePackagingError extends Error {
  readonly root: string;
  readonly reason: "secret_files" | "empty_source";
  readonly files: string[];

  constructor(
    root: string,
    reason: "secret_files" | "empty_source",
    files: string[] = [],
  ) {
    super(`source_packaging_failed:${reason}:${root}`);
    this.name = "SourcePackagingError";
    this.root = root;
    this.reason = reason;
    this.files = files;
  }
}

/** Relative paths use forward slashes on every platform, as tar entries do. */
function toPosix(relPath: string): string {
  return relPath.split(/[/\\]/).join("/");
}

async function collectFiles(
  root: string,
  excluded: Set<string>,
): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      const rel = toPosix(relative(root, absolute));

      if (entry.isDirectory()) {
        if (ALWAYS_EXCLUDED_DIRS.has(entry.name) || excluded.has(rel)) {
          continue;
        }
        await walk(absolute);
      } else if (entry.isFile()) {
        files.push(rel);
      }
      // Symlinks are skipped: a link can point outside the tree, and following
      // one would either escape the root or embed an unresolved reference the
      // build cannot honor.
    }
  }

  await walk(root);
  files.sort();
  return files;
}

/**
 * Packages one source tree into a gzipped tarball and reports the digest the
 * platform will verify. Local env files are dropped from the tarball (and
 * returned as `droppedFiles`); private-key or credential material makes the whole
 * publish refuse, since retention would make such a leak permanent. An empty
 * result also refuses — there is nothing to build.
 *
 * `excludeDirs` are paths relative to `root` (the frontend build output, say)
 * dropped in addition to `node_modules` / `.git` / `.tableverse`.
 */
export async function packSource(options: {
  root: string;
  outFile: string;
  excludeDirs?: string[];
}): Promise<PackagedSource> {
  const { root, outFile } = options;
  const excluded = new Set(
    (options.excludeDirs ?? []).map((dir) =>
      toPosix(relative(root, resolve(root, dir))),
    ),
  );

  const files = await collectFiles(root, excluded);

  const kept: string[] = [];
  const dropped: string[] = [];
  const refused: string[] = [];
  for (const file of files) {
    const treatment = classifyFile(file);
    if (treatment === "refuse") {
      refused.push(file);
    } else if (treatment === "drop") {
      dropped.push(file);
    } else {
      kept.push(file);
    }
  }

  if (refused.length > 0) {
    throw new SourcePackagingError(root, "secret_files", refused);
  }
  if (kept.length === 0) {
    throw new SourcePackagingError(root, "empty_source");
  }

  await tarCreate(
    { cwd: root, gzip: true, portable: true, noMtime: true, file: outFile },
    kept,
  );

  const { sha256, sizeBytes } = await digest(outFile);
  return {
    path: outFile,
    sha256,
    sizeBytes,
    fileCount: kept.length,
    droppedFiles: dropped,
  };
}

async function digest(
  path: string,
): Promise<{ sha256: string; sizeBytes: number }> {
  const hash = createHash("sha256");
  let sizeBytes = 0;

  for await (const chunk of createReadStream(path)) {
    sizeBytes += (chunk as Buffer).length;
    hash.update(chunk);
  }

  return { sha256: hash.digest("hex"), sizeBytes };
}
