# Splendor Web Client SDK Sequence

## Purpose

Define the implementation sequence for building the online Splendor web client
without blurring the boundary between reusable engine protocol tooling and the
hosted application server API.

## Direction

Use two separate client surfaces:

- Eden Treaty for the Splendor server's hosted HTTP and WebSocket API.
- `tabletop-cli generate client-sdk` for game-protocol-specific types and
  helpers.

The engine-generated SDK should not include room, lobby, player-session, or
game-session API code. Those APIs are host-application concerns and can vary
between servers.

## Boundary

### Hosted Server API

The Splendor server owns:

- anonymous player session tokens
- room creation
- room join by code
- ready/start flow
- host transfer
- WebSocket connection and reconnect behavior
- game session IDs
- room and game lifecycle messages

The web client should consume this API through Eden Treaty, using the exported
Elysia app type.

Expected web usage shape:

```ts
import { treaty } from "@elysiajs/eden";
import type { App } from "splendor-server";

const api = treaty<App>("localhost:3000");

await api.rooms.post({
  displayName,
  playerSessionToken,
});

await api.rooms.join.post({
  roomCode,
  displayName,
  playerSessionToken,
});

const live = api.live.subscribe({
  query: { playerSessionToken },
});
```

### Game Protocol SDK

The tabletop CLI owns:

- visible state type generation
- command request type generation
- discovery request type generation
- discovery result type generation
- small game-protocol helper types where useful

The generated SDK should describe the game payloads that flow inside the hosted
server transport, not the hosted transport itself.

Expected generated usage shape:

```ts
import type { SplendorCommandRequest } from "splendor-example";

live.send({
  type: "game_command",
  gameSessionId,
  command: {
    type: "take_three_distinct_gems",
    input: {
      colors: ["white", "blue", "green"],
    },
  } satisfies SplendorCommandRequest,
});
```

The hosted envelope owns `gameSessionId`. The generated game SDK owns the
command payload shape.

The generated SDK file should be emitted into the `outDir` configured by the
game package's `tabletop.config.ts`. For Splendor, that means:

```txt
examples/splendor/engine/generated/client-sdk.generated.ts
```

The Splendor engine package should re-export the generated types, and the web
client should import them from the engine package instead of importing generated
files by relative path.

## Why This Split

The hosted server API is product-specific. Another game host might use:

- no rooms
- public matchmaking
- authenticated accounts
- tournaments
- pass-and-play
- a different WebSocket protocol
- HTTP-only command submission

If `tabletop-engine` generates room or game-session clients, the engine starts
encoding one hosting architecture into reusable tooling. That is the wrong
abstraction boundary.

The reusable engine can still provide value by generating the stable game
protocol payloads that any host needs to send into the executor.

## Implementation Sequence

### Step 1: Export The Server App Type

Ensure the Splendor server exports an Elysia app type that the web package can
import without starting the server process.

Expected outcome:

```ts
export type App = typeof app;
```

If the current entrypoint starts listening at import time, split app creation
from process startup so Eden can import only the type safely.

For now, the web package should import the server app type directly from the
server workspace package. Avoid adding a separate type-only package or generated
server API artifact until the direct import becomes painful.

### Step 2: Add Eden To The Web Package

Install and configure `@elysiajs/eden` in `examples/splendor/web`.

Create a small web-side API module that constructs the Eden Treaty client from
environment configuration.

Expected responsibilities:

- resolve HTTP/WebSocket base URL
- expose the typed Eden client
- avoid hiding Eden response errors behind an over-abstracted wrapper too early

### Step 3: Narrow `generate client-sdk`

Refactor `packages/cli/src/commands/generate-client-sdk.ts` so the generated
artifact is a game protocol SDK, not a fake hosted client interface.

Remove or replace the current generic interface:

```ts
export interface GameClientSdk {
  getVisibleState(): Promise<VisibleState>;
  submitCommand(command: CommandRequest): Promise<CanonicalState>;
  discover(request: DiscoveryRequest): Promise<unknown>;
}
```

Generate:

- `VisibleState`
- `CommandRequest`
- `DiscoveryRequest`
- typed discovery result shapes where the protocol descriptor can provide them
- optional helper aliases such as `CommandType`

Do not generate:

- room API calls
- session token APIs
- WebSocket connection code
- server-specific lifecycle envelopes

### Step 4: Generate SDK Into The Engine Package

Use the Splendor engine package's existing `tabletop.config.ts` output
directory for client SDK generation.

Expected output:

```txt
examples/splendor/engine/generated/client-sdk.generated.ts
```

The generated file should be re-exported by the Splendor engine package, so web
UI code imports game protocol types from `splendor-example`.

### Step 5: Build The First Web Vertical Slice

Use Eden for hosted API calls and the generated SDK for game payloads.

Initial UI scope:

- main menu
- create room
- join room by code
- room screen with ready/start
- live room subscription
- game screen with raw visible state rendering
- submit at least one command through the typed command request
- same-browser reconnect using stored player session token

Avoid polished Splendor UI work until the transport and generated protocol
types have survived the first end-to-end flow.

## Expected Validation

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/cli
bun test --cwd examples/splendor/server
```

After the web vertical slice exists, also run the web package's typecheck and
build scripts.

## Open Questions

1. Discovery result typing still needs a concrete implementation decision. The
   current generated SDK should at least type discovery requests. The open part
   is whether discovery results can be rendered precisely from the current
   protocol descriptor, or whether the engine descriptor needs additional
   metadata to distinguish intermediate discovery steps from completed command
   input.
