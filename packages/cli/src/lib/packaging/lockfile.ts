import { stat } from "node:fs/promises";
import { join } from "node:path";

export const PACKAGE_LOCKFILE = "package-lock.json";

export async function hasPackageLock(root: string): Promise<boolean> {
  try {
    return (await stat(join(root, PACKAGE_LOCKFILE))).isFile();
  } catch {
    return false;
  }
}
