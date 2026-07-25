import { access } from "node:fs/promises";
import { join } from "node:path";

/**
 * Lockfiles the platform build can install from, in no particular order — the
 * build picks the package manager from whichever is present. A version without
 * one is not reproducibly rebuildable, which retention depends on, so its
 * absence stops a publish before any network call.
 */
export const KNOWN_LOCKFILES = [
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
] as const;

/** The first known lockfile present in `root`, or `null` if none is. */
export async function findLockfile(root: string): Promise<string | null> {
  for (const name of KNOWN_LOCKFILES) {
    try {
      await access(join(root, name));
      return name;
    } catch {
      // Not this one; try the next.
    }
  }
  return null;
}
