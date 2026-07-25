import { defineConfig } from "@tableverse-kit/config";
import { createFixtureGame } from "./game-named.ts";

export default defineConfig({
  game: createFixtureGame(),
  outDir: "./custom-generated",
});
