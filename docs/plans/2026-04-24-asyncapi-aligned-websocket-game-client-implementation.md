# AsyncAPI-Aligned WebSocket Game Client Implementation

## Goal

Implement an AsyncAPI-aligned generated WebSocket game client that covers only
engine-scoped gameplay interaction:

- list available commands
- discover command input
- execute command
- receive game snapshots
- receive game end payloads
- receive discovery and execution results

The implementation must keep AsyncAPI as the source of truth and must not mix
in room or session hosting APIs.

## Step 1: Introduce A Shared Engine WebSocket Protocol Model

Create a shared protocol layer in `packages/tabletop-engine/src/protocol` that
describes the canonical engine-scoped hosted WebSocket messages.

This layer should be derived from the existing game protocol descriptor and
should model:

- client request messages:
  - `game_list_available_commands`
  - `game_discover`
  - `game_execute`
- server response messages:
  - `game_available_commands`
  - `game_discovery_result`
  - `game_execution_result`
- server push messages:
  - `game_snapshot`
  - `game_ended`
- `requestId` correlation for request/response messages

Implementation target:

- a reusable descriptor or schema bundle that both AsyncAPI generation and
  client SDK generation can consume

This should avoid duplicating message-shape logic separately in:

- `generateAsyncApi(...)`
- `generate client-sdk`

## Step 2: Rework AsyncAPI Generation Around That Shared Model

Update `packages/tabletop-engine/src/protocol/asyncapi.ts` to use the shared
engine WebSocket protocol model instead of constructing message shapes inline.

The resulting AsyncAPI should now explicitly describe:

- canonical engine-scoped gameplay request messages
- canonical request/response correlation
- pushed engine updates

Update tests to lock:

- message names
- message payload shape
- request id presence on request/response messages
- per-command discovery/execute payload structure

## Step 3: Upgrade Client SDK Generation From Types To Runtime Client

Refactor `packages/cli/src/commands/generate-client-sdk.ts` so the generated
artifact exports:

- current protocol types
- a runtime `createGameEngineClient(...)`
- generic request methods:
  - `listAvailableCommands(...)`
  - `discover(...)`
  - `execute(...)`
- per-command helpers:
  - `discoverXxx(...)`
  - `executeXxx(...)`
- event hooks:
  - `onGameSnapshot(...)`
  - `onGameEnded(...)`
  - `onDiscoveryResult(...)`
  - `onExecutionResult(...)`
  - optional `onMessage(...)`

The generated client should accept an existing WebSocket-like object rather than
opening room/session connections itself.

The client implementation should:

- generate request ids
- track pending promises by request id
- resolve requests when matching engine responses arrive
- dispatch pushed events to registered handlers

## Step 4: Align The Hosted Splendor Server

Update the Splendor hosted server's engine-scoped live message contract so it
matches the new canonical protocol.

This likely means updating:

- `examples/splendor/server/src/modules/websocket/model.ts`
- `examples/splendor/server/src/modules/websocket/actions.ts`
- `examples/splendor/server/src/modules/game-session/service.ts`

Expected changes:

- rename engine-scoped message types to the canonical names
- add `requestId` to request/response gameplay messages
- emit execution/discovery responses in the canonical shape
- keep room/session-specific messages separate

Do not try to solve room API generation here.

## Step 5: Validate Against The Example Consumer

Regenerate the Splendor engine SDK and verify that the generated runtime client
is usable from the web package.

This step does not need a full UI integration rewrite yet, but it should verify
that:

- the generated client compiles
- generated per-command methods are correct
- the hosted server message contract is compatible with the generated client

## Commit Strategy

Commit in small slices:

1. plan doc
2. shared protocol model + AsyncAPI updates
3. client SDK runtime generation
4. hosted server protocol alignment
5. follow-up fixes and verification

## Verification

At minimum:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-engine
bun test --cwd packages/cli
bun test --cwd examples/splendor/server
bun run --cwd examples/splendor/web build
```
