import { defineConfig } from "tabletop-engine/config";
import { createSplendorGame } from "./src/game.ts";

export default defineConfig({
  game: createSplendorGame(),
  outDir: "./generated",
});
