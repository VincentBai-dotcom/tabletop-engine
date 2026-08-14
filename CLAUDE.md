# tableverse-kit

Monorepo for `@tableverse-kit/*`. Develop and test on the runtime we ship to:
**Node.js**, managed with **pnpm workspaces**. (Historically this repo used Bun;
it no longer does.)

## Toolchain

- **Package manager: pnpm.** Use `pnpm install`, `pnpm run <script>`,
  `pnpm -C <pkg> <script>`, `pnpm -r <script>`, `pnpm exec <bin>`,
  `pnpm dlx <pkg>`. Do not use `bun`, `npm`, or `yarn`. Workspaces are declared
  in `pnpm-workspace.yaml`; cross-package deps use the `workspace:*` protocol.
- **Runtime: Node via `tsx`.** Run/watch TypeScript with `tsx <file>` /
  `tsx watch <file>` — not bare `node <file>`. The engine's state-authoring
  facade (`GameState`, `@field(...)`) uses **legacy decorators**
  (`experimentalDecorators` in `tsconfig.json`), which Node's type-stripping
  does not transform. `tsx` (esbuild) transpiles them; bare `node` cannot.
- **Tests: Vitest.** `pnpm test` runs every package; a single package runs
  `vitest run`. Import test APIs from `vitest`
  (`import { describe, it, test, expect } from "vitest"`). Vitest (esbuild)
  honors `experimentalDecorators`, so decorator-based tests work unchanged.
- **Typecheck:** `pnpm exec tsc -b` (project references) or `pnpm -r typecheck`.
- **Lint / format:** `pnpm lint` (ESLint) and `pnpm format` (Prettier), wired
  through Husky + lint-staged on commit.

## Conventions

- Keep `@tableverse-kit/engine` runtime-agnostic and portable — no Node- or
  Bun-specific globals. It runs inside the platform's `isolated-vm` sandbox
  (a stricter bar than Node), so it should not depend on `@types/node`. Packages
  that genuinely need Node globals (`cli`, `client`, `terminal`) depend on
  `@types/node` explicitly.
- Prefer standard/Node APIs over runtime-specific ones: `node:crypto`,
  `node:fs`, `fileURLToPath(new URL(".", import.meta.url))` for the current
  directory (not `import.meta.dir`), and `process.argv[1] === fileURLToPath(import.meta.url)`
  for the "run as main" check (not `import.meta.main`).
- **Comments are a last resort, not a default.** They drift out of sync with the
  code and mislead both humans and agents; self-explanatory code (clear names,
  small functions, expressive types) is the goal. Do not narrate what the code
  already says. Reserve a comment for the rare thing code cannot express — a
  non-obvious _why_, a subtle constraint. In particular, **do not document
  behavior on an interface** (e.g. "rejects with `X`", "fires on every change"): an
  interface only constrains types, an implementation is free not to honor the prose,
  and the comment silently becomes a lie.

## Verification

```bash
pnpm install
pnpm exec tsc -b
pnpm lint
pnpm test
pnpm -C examples/splendor/terminal start   # decorator-using entry, runs under tsx
```
