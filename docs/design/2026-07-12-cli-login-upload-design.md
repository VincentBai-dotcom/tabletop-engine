# CLI Login + Upload Design (client side)

Status: accepted
Date: 2026-07-12
Scope: the `tvk` CLI in this repo (`packages/cli`).
Platform side: the server endpoints this CLI consumes are specified
separately in the private `tableverse` repo,
`docs/design/2026-07-12-cli-auth-upload-api-contract.md`. That document is the
authoritative contract; this one describes only the client.

## Context

Creators author a game with `tableverse-kit` and need two things from the
platform: a way to **authenticate** (`tvk login`) and a way to **publish** a new
game version (`tvk upload`). Today `tvk` only has offline authoring commands
(`validate`, `generate client-sdk`); it has no notion of an account or of the
platform.

This document covers the **client** half — everything that ships in this
open-source repo. The **server** half (OAuth endpoints, versions/builds
endpoints, the platform-web `/authorize` page) lives in the private `tableverse`
repo and is specified in the contract doc linked above. The CLI is implemented
first, tested against an in-process fake of that contract.

### Why the CLI is open source and holds no secret

The `tvk` CLI is a **public OAuth client**: it ships no client secret. The
loopback PKCE flow (below) is exactly the mechanism that makes a secret-less
public client safe. All authorization is enforced **server-side** on every
request via the platform's JWT access-token guard. Open-sourcing the client
code therefore leaks nothing: "security through obscurity of client code buys
you nothing." This intentionally overrides the earlier `AGENTS.md` charter note
that platform commands must live in private packages — see "Repo charter" below.

## Command surface

Four commands are added to the existing thin dispatcher in
`packages/cli/src/main.ts`. Each returns the existing `RunResult`
(`stdout` / `stderr` / `exitCode`) contract.

| Command      | Purpose                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `tvk login`  | Loopback-PKCE browser flow; stores tokens locally.                                                      |
| `tvk logout` | Deletes stored tokens; best-effort server-side refresh-token revocation.                                |
| `tvk whoami` | Prints the logged-in account via `GET /me`; the standard "is my auth working?" probe.                   |
| `tvk upload` | Links the project on first run, then packages engine and frontend source, uploads, and polls the build. |

## Login: loopback PKCE

`tvk login` uses the OAuth 2.0 Authorization Code flow with PKCE (RFC 7636) and
a loopback redirect (RFC 8252 §7.3). This is the flow used by `gcloud` and the
Vercel CLI.

### Flow

1. CLI generates a cryptographically random `code_verifier` and `state`, and
   derives `code_challenge = BASE64URL(SHA256(code_verifier))`.
2. CLI binds an HTTP listener on `127.0.0.1:0` (OS-assigned free port). The
   redirect URI is `http://127.0.0.1:<port>/callback`.
3. CLI opens the user's browser to the platform-web authorize page:

   ```
   https://dev.tableverse.io/authorize
     ?response_type=code
     &client_id=tvk-cli
     &redirect_uri=http://127.0.0.1:<port>/callback
     &code_challenge=<challenge>
     &code_challenge_method=S256
     &state=<state>
     &scope=publish
   ```

4. The platform authenticates the user and redirects the browser back to
   `http://127.0.0.1:<port>/callback?code=<code>&state=<state>` (server
   behavior is defined in the contract doc).
5. The CLI's loopback listener receives the request, verifies `state` matches
   the value it generated, and serves a plain "You can close this tab" page.
6. CLI calls `POST /oauth/token` with `grant_type=authorization_code`, the
   `code`, the `code_verifier`, and the `redirect_uri`, and receives
   `{ access_token, refresh_token, expires_in }`.
7. CLI persists the tokens (see "Token storage").

### Headless limitation

The loopback flow requires a browser on the same machine as the CLI. SSH-only
and CI environments are out of scope for this version; a token-paste or
device-code fallback can be added later without changing the client design.

## Environment selection

Two environment variables choose the deployment the CLI talks to:

| Variable             | Default                         | Selects      |
| -------------------- | ------------------------------- | ------------ |
| `TABLEVERSE_API_URL` | `https://api-dev.tableverse.io` | platform-api |
| `TABLEVERSE_WEB_URL` | `https://dev.tableverse.io`     | platform-web |

A trailing slash is stripped from either value. This is a supported feature, not
a test hook: it is how a contributor runs the CLI against a local stack, and how
anyone reaches dev or staging once the defaults point at production.

```bash
TABLEVERSE_API_URL=http://localhost:3000 \
TABLEVERSE_WEB_URL=http://localhost:5000 \
  tvk login
```

Because credentials are keyed by `apiBaseUrl` (below), a local session and a dev
session coexist rather than overwriting each other. Both variables are listed in
`tvk login --help`.

## Token storage and refresh

- **Location:** `~/.config/tableverse/credentials.json`, honoring
  `XDG_CONFIG_HOME` on Linux/macOS and `%APPDATA%\tableverse\credentials.json`
  on Windows. File mode `0600`; parent directory created `0700`.
- **Shape:**

  ```jsonc
  {
    "apiBaseUrl": "https://api-dev.tableverse.io",
    "accessToken": "…",
    "refreshToken": "…",
    "expiresAt": "2026-07-12T18:30:00.000Z",
    "account": { "id": "…", "email": "…" },
  }
  ```

  Entries are keyed by `apiBaseUrl` so a dev and a prod session can coexist.

- **Refresh:** before any authenticated call, `session` checks `expiresAt`. If
  the access token is expired or within a short skew window, the CLI silently
  exchanges the refresh token via `POST /oauth/token`
  (`grant_type=refresh_token`) and rewrites the file. If refresh fails (token
  revoked or expired), the CLI aborts with "session expired, run `tvk login`"
  and a non-zero exit code.
- **At-rest protection:** the first version uses a plaintext `0600` file — the
  approach used in practice by `gh`, `vercel`, and `firebase`. It adds no native
  dependencies and is portable. An OS-keychain backend (macOS Keychain,
  libsecret, Windows Credential Manager) is a possible future upgrade and is
  intentionally out of scope for now.

## Upload: packaging, presigned transport, build polling

`tvk upload` publishes one immutable version. The CLI uploads **source only** —
one tarball for the engine, one for the frontend — and the platform builds both.
No compiled artifact is ever uploaded.

Source-only upload means a version's served output is a function of its stored
source and lockfiles, so the two can never disagree. It is also what makes the
stored source worth keeping: a version that cannot be rebuilt is not really
retained.

### Source retention

Each version stores the complete project source, and it must be complete enough
to rebuild and to hand back — lockfiles and `package.json` included, not just
the files a build happens to read. Completeness cannot be added retroactively:
any version stored without it stays unrestorable forever.

This buys machine-portability for developers with no version control, for whom a
lost laptop is otherwise a lost game. The platform is a recovery path, not a
VCS, and is not a place to host code you are working in.

Retention has one real cost: source trees collect `.env` files, keys, and
credentials, and retaining them makes any leak permanent. Packaging therefore
sorts recognized-sensitive files two ways. Local env files (`.env`,
`.env.local`, and the like) are **dropped** from the tarball and named in the
output — they are conventional in a project root, so excluding them silently and
continuing is what every frontend host does. Private-key and credential material
(`*.pem`, `*.key`, `id_rsa`, `.npmrc`, …) instead **refuses** the publish: a key
in a source root is rare enough that stopping to make the developer look is worth
the friction. `.env.example` and its siblings are kept, being checked-in
templates. `tvk upload` states plainly that source is stored.

### What the platform builds

Both builds run in the same isolated, ephemeral build environment — the same
container isolation, the same narrowly scoped IAM role, the same log capture and
status reporting. They differ only in what they produce.

**Engine.** Bundled to a single self-contained ES module for the `isolated-vm`
sandbox. Third-party dependencies are allowed and installed from the lockfile:
seeded RNG, immutable-update helpers, and math utilities are ordinary needs for
game logic, and banning them only pushes people to vendor code by copy-paste,
where it is unauditable and unpatchable. The dependency's origin carries no
runtime risk the author's own code does not — the isolate bounds everything in
the bundle equally.

The binding constraint is compatibility, not provenance. The isolate has no Node
APIs, no filesystem, no network, and no browser globals, so the build fails on
any unresolved external or `node:*` import, and enforces a bundle size cap
because each running game holds an isolate with a memory ceiling. Both are
checked at bundle time, so an incompatible dependency fails a publish rather
than a game in progress.

**Frontend.** The project's own build command, run against its lockfile,
producing static assets. There is no constraint on how a game draws itself —
React over static art, canvas, WebGL, three.js, and WebAssembly are all just
build output. This code runs in the player's browser, where it holds no
privilege the platform needs to defend.

Untrusted code executes in both builds, including whatever `npm ci` triggers via
postinstall. That is a property of the build environment, addressed by isolation
and by a build role scoped to writing one storage prefix — not by restricting
what either half may depend on.

### Game identity and linking

A game's identity is a row in the platform database, and its primary key is the
only thing that says which game an upload belongs to. It is opaque, immutable,
and issued by the platform. Nothing derives it from `game.name`, which is
display text the developer must stay free to change — renaming a game publishes
the next version of that same game, exactly as renaming a site does not create a
new site.

The CLI's job is to remember which game a project directory belongs to, which it
does with one generated file:

```jsonc
// .tableverse/game.json — written and read by tvk upload
{ "gameId": "3f8a1c02-7d5e-4b91-a6c3-9e2f0b4d7188" }
```

The file lives in the project directory and travels with the folder by whatever
means its owner already moves folders. The CLI makes no assumption that the
project is under version control: it never creates or edits a `.gitignore`, and
a developer working alone in a folder on one machine is a fully supported case.
Whether the project's source is published anywhere is the developer's decision
and has no bearing on this design.

`TABLEVERSE_GAME_ID` overrides the file when set, so scripted publishing needs
no writable project directory.

**Linking happens on the first upload**, not in a separate command. When
`tvk upload` finds no link, it lists the games the logged-in account owns and,
with an arrow-key picker, lets the developer create a new game (named from
`game.name`) or bind to an existing one, then writes `game.json`. The developer
never types or sees an identifier. This is also the recovery path: a project
whose `game.json` was deleted is simply unlinked again, so the next `tvk upload`
re-runs the picker — which matters because a project with no version control has
nothing to restore the file from.

The picker needs a terminal on both ends. In a non-interactive shell (CI, piped
input) an unlinked project cannot prompt, so `tvk upload` stops and asks for an
explicit `TABLEVERSE_GAME_ID` rather than silently creating a duplicate game.

Two mistakes are worth designing against explicitly:

- **A copied project directory.** Duplicating a folder to start a second game
  carries `game.json` with it, so an upload would silently ship a new version of
  the original. Authorization cannot catch this — the same account owns both. So
  `tvk upload` resolves the id to its name and prints
  `Publishing to Slaylike (3f8a1c02-7d5e-4b91-a6c3-9e2f0b4d7188)` before it packages anything, putting
  the wrong target in front of the developer while it is still cheap to stop.
- **A directory linked to someone else's game.** The platform rejects the
  upload; the CLI reports that the project is linked to a game the account cannot
  access and to delete `.tableverse/game.json` and re-run `tvk upload` to publish
  it as their own, rather than surfacing a raw 403.

### Config additions

`defineConfig` lives in its own package, **`@tableverse-kit/config`**, rather than
in the engine: a project's config is a build/deploy concern, and the engine is
the sandboxed rule runtime that runs inside `isolated-vm` and never sees a
`publish` block. The config carries an optional `publish` block describing what
to package. It carries no identity: `game.json` is CLI-written state, and keeping
it out of a hand-authored TypeScript file means the CLI can rewrite it without
parsing and preserving someone's source.

```ts
defineConfig({
  game,
  publish: {
    engine: { root: "." }, // engine package source dir
    frontend: {
      root: "./web", // frontend source dir
      buildCommand: "npm run build", // run by the platform, in ./web
      outDir: "dist", // build output, relative to frontend.root
    },
  },
});
```

The existing `game` and `outDir` fields are unchanged; `publish` is only
required for `tvk upload`. Nothing here points at a build artifact on the
developer's machine — every path is source the platform builds.

### Flow

1. Load config; resolve `publish`. Verify both source roots exist and each
   carries a lockfile — without one the version is not rebuildable, so this
   fails **before any network call**.
2. Resolve the target game. Take `gameId` from `TABLEVERSE_GAME_ID` or
   `.tableverse/game.json`; a linked id is confirmed with `GET /games/:gameId`,
   where a 403/404 surfaces a stale or foreign link. An unlinked directory runs
   the first-run picker (`GET /games`, then `POST /games` if the developer
   creates one) and writes `game.json`, or — non-interactively — stops for
   `TABLEVERSE_GAME_ID`. Either way, print `Publishing to <name> (<gameId>)`
   before any packaging.
3. In a temp directory, build two gzipped tarballs and compute each one's
   `sha256` and byte size:
   - **engine source** = everything under `engine.root`, excluding
     `node_modules`, `.git`, `.tableverse`, and local env files.
   - **frontend source** = everything under `frontend.root`, plus its build
     `outDir`, same exclusions. Dropped env files are named in the output.
4. `POST /versions` with
   `{ gameId, engineSourceSha256, engineSourceSizeBytes, frontendSourceSha256, frontendSourceSizeBytes }`
   → `{ versionId, versionNumber, putUrls, expiresAt }`. Each `putUrls` entry is
   a short-lived presigned `PUT` of the form `{ url, headers }`.
5. `PUT` each tarball **directly to its presigned URL**, sending the returned
   `headers` verbatim — the declared `sha256` is bound into the signature, so
   storage rejects a body whose digest differs. Bytes never transit
   platform-api.
6. `POST /versions/:versionId/build` → `{ buildId }`. The platform verifies each
   expected object exists and its digest matches the declared `sha256` before
   starting; it never sees the bytes in transit, so this is where an incomplete
   upload is caught.
7. Poll `GET /builds/:buildId` (interval and overall timeout configurable via
   `TABLEVERSE_BUILD_POLL_INTERVAL_MS` / `TABLEVERSE_BUILD_POLL_TIMEOUT_MS`)
   until `status` is `ready` or `failed`. Step labels are streamed as they
   arrive (`install ✓ engine ✓ frontend ✓ smoke ✓`). On `ready`, print
   `Published <name>@v<N>`. On `failed`, print the failing step and `logsUrl`
   and exit non-zero. If the timeout passes with the build still `queued` — the
   case when no build runner is deployed — say so rather than hang.

Builds install dependencies, so publishing takes minutes rather than seconds and
the first publish of a project is the slowest. The CLI streams step labels for
that reason: a silent multi-minute wait reads as a hang.

### Platform endpoints consumed

Full request/response shapes are in the contract doc. The CLI calls:

- `POST /oauth/token` — token exchange and refresh.
- `POST /auth/logout` — best-effort refresh-token revocation on `logout` (existing endpoint).
- `GET /me` — account for `whoami`.
- `GET /games` — the account's games, for the first-run picker.
- `POST /games` — create a game; returns the game, including its id.
- `GET /games/:gameId` — resolve a linked id to its display name.
- `POST /versions` — create a pending version; returns one presigned `PUT`
  (`{ url, headers }`) per source tarball.
- `PUT <presigned URL>` — upload each tarball directly to object storage, sending
  the issued `headers` verbatim.
- `POST /versions/:versionId/build` — trigger the build.
- `GET /builds/:buildId` — poll build status.

## CLI internal structure

New modules under `packages/cli/src/`, each with a single responsibility:

- `lib/auth/pkce.ts` — `code_verifier` / `code_challenge` / `state` generation
  (via `node:crypto`).
- `lib/auth/loopback-server.ts` — the `127.0.0.1` callback listener; resolves
  with `{ code, state }` or rejects on timeout / mismatch.
- `lib/auth/token-store.ts` — read / write / delete `credentials.json` (`0600`),
  keyed by `apiBaseUrl`.
- `lib/auth/session.ts` — "return a valid access token," performing
  refresh-if-needed. The single entry point authenticated commands call.
- `lib/platform-client.ts` — typed wrapper over the platform HTTP API
  (`token`, `me`, `listGames`, `createGame`, `getGame`, `createVersion`,
  `uploadArtifact`, `startBuild`, `getBuild`). Takes an **injectable `fetch`**
  and `apiBaseUrl`.
- `lib/link/game-link.ts` — read / write `.tableverse/game.json` and apply the
  `TABLEVERSE_GAME_ID` override. The only module that knows where the link is
  stored.
- `lib/link/link-prompt.ts` — the first-run arrow-key create-or-pick picker,
  behind a `LinkPrompt` seam so `upload` is testable without a terminal.
- `lib/packaging/{tarball,secrets,lockfile}.ts` — build the engine / frontend
  tarballs and compute `sha256`; classify sensitive files (drop vs refuse);
  find the source-root lockfile.
- `lib/upload/{context,poll-build,errors}.ts` — the injected `upload`
  collaborators, the build-poll loop, and error-to-sentence mapping.
- `commands/login.ts`, `commands/logout.ts`, `commands/whoami.ts`,
  `commands/upload.ts` — orchestration only; return `RunResult`.

### Testability

The real platform endpoints do not exist yet, so the CLI is built to be tested
in isolation. `platform-client`, the loopback flow, and `upload` accept injected
collaborators: `fetch`, a browser-opener, and a clock. Vitest tests drive each
command against an **in-process fake platform** — a `fetch` stub that implements
the contract, plus a fake S3 `PUT` sink — with no network and deterministic
timing. This validates the CLI now and keeps it honest against the contract
until the server ships.

## Error handling and edge cases

- **Not logged in** (`upload` / `whoami` with no stored token): clean "not
  logged in, run `tvk login`" message and non-zero exit — never a raw 401.
- **Refresh token expired mid-command:** same clean re-login prompt.
- **`state` mismatch or loopback timeout** (user closed the tab; 5-minute cap):
  abort cleanly and free the port.
- **Presigned URL expired between issue and PUT:** surface "upload window
  expired, retry `tvk upload`."
- **Build `failed`:** non-zero exit with the failing step and `logsUrl`. The
  build runs the developer's own build command against their lockfile, so this
  is the common failure and the message must lead with the step and the log, not
  with a status code.
- **Missing source root or lockfile:** fail before any network call.
- **Credential material in the source** (`*.pem`, `id_rsa`, `.npmrc`, …): refuse
  the publish, naming the files. Local env files are dropped and named instead,
  not treated as an error.
- **Engine incompatible with the isolate** (unresolved external, `node:*`
  import, bundle over the size cap): reported as a build failure naming the
  offending import or the limit.
- **Unlinked project** (`upload` with no `game.json` and no
  `TABLEVERSE_GAME_ID`): run the first-run create-or-pick picker; in a
  non-interactive shell, stop and ask for `TABLEVERSE_GAME_ID`.
- **Link to an inaccessible game** (403/404 on `GET /games/:gameId`): report that
  the project is linked to a game the account cannot reach and to delete
  `.tableverse/game.json` and re-run `tvk upload` to publish it as their own,
  never a raw status code.
- **Unreadable / malformed `game.json`:** treat it as a link failure naming the
  file path, and direct the developer to delete it and re-run `tvk upload` — the
  file is CLI-owned state, so repair is a re-link, not hand-editing.
- **Build still `queued` at the poll timeout** (no build runner deployed): report
  it plainly rather than hang, and note `TABLEVERSE_BUILD_POLL_TIMEOUT_MS`.
- **Loopback port bind failure:** retry a couple of times, then a clear message.

## Repo charter and cleanup

- **Charter override:** `AGENTS.md` currently states that platform commands
  (`login` / `upload` / `deploy`) must live in private Tableverse-owned
  packages. This design intentionally supersedes that: the CLI is a public OAuth
  client that holds no secret, and all authorization is enforced server-side, so
  the command code is safe to open source. `AGENTS.md` is updated to reflect
  that the open-source CLI may contain platform _client_ code while the platform
  _server_ remains private.
- **Shebang fix:** `packages/cli/src/main.ts` still begins with
  `#!/usr/bin/env bun`, a leftover from the Bun→Node migration. It is corrected
  to `#!/usr/bin/env node` as part of this work.

## Out of scope

- Headless / CI login (no local browser).
- OS-keychain token storage.
- Standalone frontend-only or engine-only publish commands.
- The server-side endpoints (specified in the `tableverse` contract doc).
- `tvk pull` / restore. Retention makes it possible; nothing ships until asked
  for.

### Backlog

**Live editing.** Publish-time builds are batch work: cold, ephemeral, minutes
each. Editing a game in the browser needs the opposite — a warm environment per
active editor with hot reload — which is a different kind of infrastructure and
a design of its own. Retaining source and building server-side is what leaves
that door open, since source can already change without a developer's laptop in
the loop.

**Build-time environment variables.** Frontends routinely bake values in at
build time. Those exist on the developer's machine and not in the build
environment, so any game that needs them cannot publish until per-game build
config exists, with the storage, UI, and secret-handling that implies. This is
the likeliest source of unplanned scope.

**Build caching.** Dependency install dominates build time. Caching it is an
optimization, not a correctness concern, and is deferred until publish latency
is measured rather than assumed.

**Standalone `tvk link`.** Linking is folded into `tvk upload`'s first run, which
covers binding and recovery because both start from an unlinked directory. A
separate command is only needed to _re-link_ an already-linked directory to a
different game without publishing — not required yet, so not built.

**Transmitting build config.** `publish.frontend.buildCommand` and `outDir` are
declared in config but not yet sent anywhere; `POST /versions` carries only
digests and sizes. When the build runner ships it needs both. The intended
source is the config file already inside the uploaded engine tarball, keeping
source the single source of truth — to be confirmed against the runner.

GitHub sync sits alongside these rather than in the sequence.
