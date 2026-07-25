import type { AnyGameDefinition } from "@tableverse-kit/engine";

/**
 * The engine half of a publish. `root` is the directory whose source the
 * platform builds into the `isolated-vm` bundle; it holds the `package.json`
 * and lockfile that define the build. The CLI uploads this tree as source — no
 * compiled artifact and no output directory, because the engine bundle is a
 * build product the platform owns, not a path on the developer's machine.
 */
export interface EnginePublishConfig {
  /** Source directory of the engine package, relative to the config file. */
  root: string;
}

/**
 * The frontend half of a publish. The platform runs `buildCommand` inside
 * `root` against the project's own lockfile and serves `outDir`. The CLI never
 * runs the build; it only uploads `root` as source.
 */
export interface FrontendPublishConfig {
  /** Source directory of the frontend, relative to the config file. */
  root: string;
  /** Build command the platform runs inside `root` (e.g. `npm run build`). */
  buildCommand: string;
  /** Build output directory the platform serves, relative to `root`. */
  outDir: string;
}

/**
 * What `tvk upload` packages. Both halves are source: the platform builds each
 * one, so nothing here points at a compiled artifact on the developer's
 * machine. Identity is deliberately absent — which game a directory publishes
 * to is CLI-written state in `.tableverse/game.json`, not hand-authored config.
 */
export interface PublishConfig {
  engine: EnginePublishConfig;
  frontend: FrontendPublishConfig;
}

/**
 * A Tableverse project's configuration, authored in `tableverse.config.ts` and
 * read by the `tvk` CLI. It lives in its own package rather than in the engine
 * because it is a build/deploy concern, not part of the sandboxed rule runtime:
 * `publish` describes how to package and build a project, which the engine
 * running inside `isolated-vm` never sees.
 */
export interface TableverseConfig {
  /** The built game definition, produced with `@tableverse-kit/engine`. */
  game: AnyGameDefinition;
  /** Output directory for `tvk generate` (e.g. the client SDK). */
  outDir?: string;
  /** How `tvk upload` packages the project. Required only for publishing. */
  publish?: PublishConfig;
}

/**
 * Identity helper: returns its argument unchanged, present only so a config file
 * gets full type-checking and editor completion on the object literal. This is
 * the same pattern as `vitest`'s and `astro`'s `defineConfig`.
 */
export function defineConfig(config: TableverseConfig): TableverseConfig {
  return config;
}
