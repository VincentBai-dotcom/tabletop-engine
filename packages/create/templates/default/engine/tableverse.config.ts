import { defineConfig } from "@tableverse-kit/config";
import { game } from "./src/game.ts";

export default defineConfig({
  game,
  publish: {
    engine: { root: "." },
    frontend: {
      root: "../client",
      buildCommand: "pnpm build",
      outDir: "dist",
    },
  },
});
