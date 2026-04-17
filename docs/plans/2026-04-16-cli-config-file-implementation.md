# CLI Config File Implementation Plan

## Goal

Move `tabletop-cli` from a path-and-export-driven loading model to a
config-file-driven model centered on one explicit built `GameDefinition`.

Target developer experience:

```ts
// tabletop.config.ts
import { defineConfig } from "tabletop-engine/config";
import { createSplendorGame } from "./examples/splendor/src/game";

export default defineConfig({
  game: createSplendorGame(),
  outDir: "./examples/splendor/generated",
});
```

Then:

```bash
tabletop-cli generate types
tabletop-cli generate schemas
tabletop-cli generate protocol
tabletop-cli generate client-sdk
tabletop-cli validate
```

Optional override:

```bash
tabletop-cli generate types --config ./path/to/tabletop.config.ts
```

## Current State

The current CLI depends on:

- `--game <path>`
- optional `--export <name>`
- `loadGame(...)` export inference
- `createGenerationContext(...)` built around a source module path

Relevant files:

- [main.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/cli/src/main.ts)
- [parse-args.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/cli/src/lib/parse-args.ts)
- [generation-context.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/cli/src/lib/generation-context.ts)
- [load-game.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/cli/src/lib/load-game.ts)

This is the implementation surface to replace.

## Constraints

- do not introduce a new worktree
- keep the CLI config shape minimal in v1:
  - `game`
  - optional `outDir`
- keep expansion selection out of the CLI
- preserve current command set:
  - `generate types`
  - `generate schemas`
  - `generate protocol`
  - `generate client-sdk`
  - `validate`
- use a transition path only if needed, but make config the primary model

## Plan

### Step 1: Lock the new config contract in tests

Add failing tests that define the new boundary before changing implementation.

Required tests:

- config loader reads `tabletop.config.ts` from the current working directory
- `--config` overrides the default location
- config loader accepts a built `GameDefinition`
- config loader rejects invalid config shapes
- generation commands succeed with only config-driven input
- validation succeeds with only config-driven input
- help and argument parsing reflect `--config`, not `--game` / `--export`

Likely files:

- `packages/cli/tests/load-config.test.ts`
- `packages/cli/tests/main.test.ts`
- `packages/cli/tests/generate-*.test.ts`
- `packages/cli/tests/validate.test.ts`

### Step 2: Add a dedicated config module surface

Create a CLI-side config definition API.

Likely files:

- `packages/tabletop-engine/src/config.ts`
- package export wiring in `packages/cli/package.json`

Responsibilities:

- define `TabletopCliConfig`
- expose `defineConfig(...)`
- keep typing minimal and explicit

This should make the documented authoring model real.

### Step 3: Implement config loading

Replace source-module inference with config loading.

Likely new helper:

- `packages/cli/src/lib/load-config.ts`

Responsibilities:

- locate default `tabletop.config.ts`
- support `--config`
- import the config module
- validate the default export shape
- validate that `config.game` is a built `GameDefinition`
- resolve `outDir` relative to the config file location or cwd

This step should make `load-game.ts` obsolete for the primary flow.

### Step 4: Replace argument parsing and generation context

Change the CLI argument model to revolve around config rather than raw game
path flags.

Required changes:

- remove `gamePath` and `exportName` from parsed command arguments
- add `configPath?: string`
- keep `snapshotPath?: string`
- make `GenerationContext` use config-resolved values

Likely files:

- `packages/cli/src/lib/parse-args.ts`
- `packages/cli/src/lib/generation-context.ts`
- `packages/cli/src/main.ts`

### Step 5: Migrate command implementations to the config context

Update all commands to consume the new generation context without any knowledge
of module export inference.

Files:

- `packages/cli/src/commands/generate-types.ts`
- `packages/cli/src/commands/generate-schemas.ts`
- `packages/cli/src/commands/generate-protocol.ts`
- `packages/cli/src/commands/generate-client-sdk.ts`
- `packages/cli/src/commands/validate.ts`

This should be mostly mechanical once context loading is stable.

### Step 6: Add a repo-level example config

Create an example `tabletop.config.ts` in the consuming game package so the
actual monorepo works the way the new CLI expects.

Recommended shape:

```ts
import { defineConfig } from "tabletop-engine/config";
import { createSplendorGame } from "./examples/splendor/src/game";

export default defineConfig({
  game: createSplendorGame(),
  outDir: "./examples/splendor/generated",
});
```

This also serves as living documentation.

### Step 7: Remove legacy path/export-first code

Once tests and commands are green under the config model, remove the obsolete
primary path.

Expected cleanup:

- delete or deprecate `load-game.ts`
- remove `--game`
- remove `--export`
- update help text and tests

If keeping a temporary compatibility path is technically simpler, it must be
clearly secondary and should not remain undocumented as the primary flow.

### Step 8: Update docs to match the actual implementation

Update existing CLI docs to reflect the new config model.

Files likely affected:

- [2026-04-10-cli-artifact-generation-design.md](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-10-cli-artifact-generation-design.md)
- [2026-04-14-cli-current-gaps.md](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-14-cli-current-gaps.md)
- [2026-04-16-cli-config-file-design.md](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-16-cli-config-file-design.md) if implementation details deviate

## Expected Verification

Minimum:

```bash
bun test --cwd packages/cli
bunx tsc -b
```

Recommended final verification:

```bash
bun run lint
bun test --cwd packages/cli
bunx tsc -b
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

## Risk Areas

- package export wiring for `tabletop-engine/config`
- relative path resolution for `outDir`
- keeping tests stable when switching from `--game` flags to cwd/config-based
  loading
- deciding whether to keep any temporary backward-compatible path-based
  loading

## Expected Deviations To Watch For

If the implementation hits a real technical blocker, the most likely acceptable
deviation is:

- temporarily supporting both config-driven loading and the old `--game` path
  loading

That would be acceptable only as a transition path. The primary documented and
tested experience should still be config-first.
