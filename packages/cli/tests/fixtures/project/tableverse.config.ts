import { defineConfig } from "@tableverse-kit/config";
import createFixtureGame from "../game-default.ts";

export default defineConfig({
  game: createFixtureGame(),
  publish: {
    engine: { root: "./engine" },
    frontend: {
      root: "./web",
      buildCommand: "npm run build",
      outDir: "dist",
    },
  },
});
