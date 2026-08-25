#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scaffold } from "./scaffold.ts";

const usage = `Usage: create-tableverse <directory>

Scaffolds a Tableverse project: a pnpm workspace with an engine package (your
game's rules) and a client package (the frontend that renders them).`;

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function run(argv: string[]): Promise<RunResult> {
  const [target] = argv;

  if (!target || target === "--help" || target === "-h") {
    return {
      exitCode: target ? 0 : 1,
      stdout: target ? usage : "",
      stderr: target ? "" : usage,
    };
  }

  const targetDir = resolve(process.cwd(), target);

  if (existsSync(targetDir) && (await readdir(targetDir)).length > 0) {
    return { exitCode: 1, stdout: "", stderr: `directory_not_empty:${target}` };
  }

  const projectName = toProjectName(basename(targetDir));
  const version = await readOwnVersion();

  await scaffold({
    targetDir,
    projectName,
    tableverseVersion: `^${version}`,
  });

  return { exitCode: 0, stdout: nextSteps(target), stderr: "" };
}

function toProjectName(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "tableverse-game";
}

async function readOwnVersion(): Promise<string> {
  const manifestPath = fileURLToPath(
    new URL("../package.json", import.meta.url),
  );
  const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    typeof manifest === "object" &&
    manifest !== null &&
    "version" in manifest &&
    typeof manifest.version === "string"
  ) {
    return manifest.version;
  }
  throw new Error("create_package_missing_version");
}

function nextSteps(target: string): string {
  return `Scaffolded ${target}.

Next steps:
  cd ${target}
  pnpm install
  pnpm dev`;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const result = await run(argv);
  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }
  process.exitCode = result.exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
