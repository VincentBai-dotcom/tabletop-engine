import createFixtureGame from "../game-default.ts";

export default {
  game: createFixtureGame(),
  publish: {
    engine: { root: " .\\engine " },
    frontend: {
      root: " .\\client ",
      buildCommand: " npm run build ",
      outDir: " dist ",
    },
  },
};
