import { defineConfig } from "tabletop-engine/config";
import { createFixtureGame } from "./game-named.ts";

export default defineConfig({
  game: createFixtureGame(),
  outDir: "./custom-generated",
});
