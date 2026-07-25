import { basename } from "node:path";

/**
 * Directories never included in a source tarball, matched by name at any depth.
 * `node_modules` is reinstalled from the lockfile by the build; `.git` is
 * history the platform is not a home for; `.tableverse` is the CLI's own link
 * state, not project source.
 */
export const ALWAYS_EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".tableverse",
]);

// `.env` variants that are checked-in templates, not real secrets: they belong
// in the tarball.
const ENV_ALLOWLIST_SUFFIXES = [".example", ".sample", ".template", ".dist"];

// Basenames that are private keys or credential material outright.
const SECRET_BASENAMES = new Set([
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  ".npmrc",
  ".netrc",
]);

// Extensions that carry private keys or certificates with the key attached.
const SECRET_EXTENSIONS = [".pem", ".key", ".p12", ".pfx", ".keystore"];

/**
 * How packaging treats a file, matched on its name:
 *
 * - `include` — ordinary source, tarred as-is.
 * - `drop` — a local env file (`.env`, `.env.local`, …). Never uploaded, but its
 *   presence is normal in a project root, so it is quietly excluded rather than
 *   treated as an error. This is what every frontend host does with `.env`.
 * - `refuse` — private-key or credential material. These are almost never
 *   legitimately in a publish root, and since retention makes a leak permanent,
 *   the packager stops and makes the developer look rather than guessing.
 *
 * `.env.example` and friends are `include`: they are the checked-in templates a
 * project publishes on purpose.
 */
export type FileTreatment = "include" | "drop" | "refuse";

export function classifyFile(relPath: string): FileTreatment {
  const name = basename(relPath).toLowerCase();

  if (SECRET_BASENAMES.has(name)) {
    return "refuse";
  }

  if (SECRET_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "refuse";
  }

  if (name === ".env" || name.startsWith(".env.")) {
    return ENV_ALLOWLIST_SUFFIXES.some((suffix) => name.endsWith(suffix))
      ? "include"
      : "drop";
  }

  return "include";
}
