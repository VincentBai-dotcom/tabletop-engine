import { defineConfig } from "@tableverse-kit/config";
import { createSplendorGame } from "./src/game.ts";

export default defineConfig({
  game: createSplendorGame(),
  outDir: "./generated",
  publish: {
    // Engine source root: the directory holding this config, so `.` packages
    // package.json, src/, generated/, and the lockfile beside it.
    engine: { root: "." },
    frontend: {
      root: "../web", // examples/splendor/web
      buildCommand: "npm run build",
      outDir: "dist", // vite's default output, relative to ../web
    },
  },
});
