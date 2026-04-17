import { defineConfig } from "tabletop-engine/config";
import createFixtureGame from "./game-default.ts";

export default defineConfig({
  game: createFixtureGame(),
  outDir: "./generated-from-config",
});
