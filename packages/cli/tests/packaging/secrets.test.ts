import { describe, expect, it } from "vitest";
import { classifyFile } from "../../src/lib/packaging/secrets.ts";

describe("classifyFile", () => {
  it.each([
    ".env",
    ".env.local",
    ".env.production",
    "web/.env",
    "web/.env.local",
  ])("drops local env file %s", (path) => {
    expect(classifyFile(path)).toBe("drop");
  });

  it.each([
    "id_rsa",
    "keys/id_ed25519",
    "server.pem",
    "tls.key",
    "cert.p12",
    ".npmrc",
    ".netrc",
  ])("refuses credential file %s", (path) => {
    expect(classifyFile(path)).toBe("refuse");
  });

  it.each([
    ".env.example",
    ".env.sample",
    ".env.template",
    "src/index.ts",
    "package.json",
    "public/logo.png",
    "readme.md",
  ])("includes %s", (path) => {
    expect(classifyFile(path)).toBe("include");
  });
});
