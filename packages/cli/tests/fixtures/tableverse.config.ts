import { defineConfig } from "@tableverse-kit/config";
import createFixtureGame from "./game-default.ts";

export default defineConfig({
  game: createFixtureGame(),
  outDir: "./generated-from-config",
});
