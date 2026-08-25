import { defineConfig } from "@tableverse-kit/config";
import { createSplendorGame } from "./engine/src/game.ts";

export default defineConfig({
  game: createSplendorGame(),
  outDir: "./engine/generated",
  publish: {
    engine: { root: "./engine" },
    frontend: {
      root: "./web",
      buildCommand: "npm run build",
      outDir: "dist",
    },
  },
});
