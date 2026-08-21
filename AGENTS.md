# tableverse-kit

Context for an agent working in this repo. Toolchain rules (pnpm, `tsx`,
Vitest, decorators, casting/comment conventions) live in `CLAUDE.md` and are
authoritative — read it first. This file explains _what_ the project is, where
its boundaries are, and how the packages fit together.

## What this is

`tableverse-kit` is the public, open-source game-authoring SDK for **Tableverse**
(the hosted product). It ships the authoring surface only: you model game state,
define and execute player commands, project hidden information, and hand
Tableverse a single `GameExecutor`. The repo is public so customers can inspect
exactly how their game executes.

The boundary between this repo and the platform is the **`GameExecutor`**. This
repo owns everything needed to author a game and produce that executor.
Tableverse owns everything downstream of it — transport, HTTP/WebSocket servers,
rooms, matchmaking, auth, persistence, deployment, hosting, billing. Those are
not features we're declining to build yet; they are out of charter.

Bring-your-own-server / transport-agnostic usage is **not** a supported path. A
`GameExecutor` is plain enough that a determined user could drive it from their
own transport, but the repo does not document or build toward that.

## Packages

Workspaces are `packages/*` and `examples/*/*` (see `pnpm-workspace.yaml`).
Cross-package deps use `workspace:*`.

Published `@tableverse-kit/*` family:

- **`engine`** (`packages/engine`) — the rules/runtime core. Compiles a game
  definition into a `GameExecutor`. Runtime-agnostic and portable: it runs
  inside the platform's `isolated-vm` sandbox, so it must not depend on
  `@types/node` or any Node/Bun globals. Single entry (`.`); the former
  `engine/config` subpath is gone — publish config now lives in the `config`
  package.
- **`cli`** (`packages/cli`) — the `tvk` command. Local authoring plus the
  platform handoff: `validate`, `dev` (local dev server), `login` / `logout` /
  `whoami` (platform auth), and `upload` (publish source to Tableverse).
- **`client`** (`packages/client`) — the renderer-agnostic `TableverseClient`
  interface and the `GameShapeOf` type machinery that derives a game's
  view/command/discovery/event shapes from its `GameExecutor`. No concrete
  adapter ships yet; local/dev usage runs a real local server. Renamed from the
  former `@tableverse-kit/ui`; the styled component kit is cancelled. Thin React
  hooks (`client/react`) are deferred.
- **`config`** (`packages/config`) — the publish-config contract shared by the
  CLI and platform: `PublishConfig` with an `engine` half (source `root` the
  platform builds into the sandbox bundle) and a `frontend` half (`root`,
  `buildCommand`, `outDir` the platform builds and serves). Both halves are
  source — nothing points at a compiled artifact.
- **`create`** (`packages/create`) — the `create-tableverse-kit` scaffolder.
  `templates/` ships **verbatim** to the generated project (it's in
  `.prettierignore`; formatting it would rewrite emitted files and break
  `{{token}}` placeholders).
- **`docs`** (`packages/docs`) — the Mintlify docs site (`@tableverse-kit/docs`,
  private). MDX pages + `docs.json`. The `mint` CLI is **not** a workspace dep
  (install globally: `npm i -g mint`). MDX is `.prettierignore`d — Prettier
  corrupts fenced code inside Mintlify components. See `packages/docs/AGENTS.md`.

Examples (real consumer documentation, not throwaway):

- `examples/splendor/engine` — a reference game built on the engine.
- `examples/splendor/terminal` — terminal client exercising discovery and
  hosted-style gameplay locally (`pnpm start:splendor`).
- `examples/splendor/web` — web frontend example.

## Engine internals (`packages/engine/src`)

- `runtime/` — command execution, progression orchestration, runtime events,
  transactional execution against a cloned working state.
- `state/`, `state-facade/` — canonical `{ game, runtime }` state, and the
  class-authored facade (`GameState`, `@field(...)`, `t`) with hydration and
  viewer-specific visibility projection (`getView`, `configureVisibility`,
  `hidden`, `visibleToSelf`).
- `schema/` — the shared runtime schema API `t` (TypeBox-backed).
- `rng/` — deterministic RNG with persisted cursor state.
- `snapshot/`, `replay/`, `testing/` — snapshots, replay helpers, and
  scenario-style test harness support.
- `command-factory.ts`, `stage-factory.ts`, `game-definition.ts` — the
  `GameDefinitionBuilder` / `createGameExecutor` authoring entry points.

## CLI internals (`packages/cli/src`)

- `commands/` — `dev`, `validate`, `upload`, `login`, `logout`, `whoami`.
- `lib/` — config loading, game-descriptor extraction, generation context,
  packaging/upload, platform + auth clients, dev server, arg parsing, output
  helpers. Keep generic generation logic here, not in the engine runtime.

## Architectural direction

- Prefer explicit engine semantics over framework magic.
- Keep authoritative canonical state separate from viewer-facing visible state;
  games author against facade classes while the executor persists plain
  canonical data.
- Keep execution deterministic and replayable.
- The engine's output is a `GameExecutor`; transport and hosting live in
  Tableverse, not here. Keep hosted-platform details out of public packages.
- Prefer plain serializable outputs for hosted/client-facing data.
- Preserve the public naming direction (`GameExecutor`, `GameEvent`,
  `GameState`, the scoped `@tableverse-kit/*` family); avoid reintroducing
  vague low-level naming in the consumer API.

## Non-goals and deferrals

Out of charter (platform's job): transport, web-framework integration, auth,
lobby/matchmaking, persistence products, UI rendering, deployment, hosted
protocol contracts, platform SDK generation.

Deferred (not yet built): trigger engine; stack/queue resolution model; richer
event-resolution model distinct from player-facing logs; persistence adapters;
`client/react` hooks; private platform command handoff.

When an architecture decision changes materially, update the design docs in
`docs/design/` (dated `YYYY-MM-DD-*.md`).

## Verification

```bash
pnpm install
pnpm exec tsc -b
pnpm lint
pnpm test                 # every package, via Vitest
pnpm start:splendor       # decorator-using entry, runs under tsx
```
