# Strict Command And Discovery Requests

## Decision

For player-authored command execution and discovery, `actorId` and `input` should
both be required.

This applies to:

- `gameExecutor.executeCommand(...)`
- `gameExecutor.discoverCommand(...)`
- `validate()` command context
- `execute()` command context
- `discover()` command context

This does **not** mean every transport-facing or protocol-adjacent type must be
removed. It means the engine should have a strict request contract for player
actions instead of exposing the current loose `{ actorId?, input? }` shape in
its core execution path.

## Why

### 1. Executed commands should always have concrete input

The engine already requires `commandSchema` for every command definition. A
command being validated or executed should therefore always receive an `input`
object matching that schema.

Even for commands with an empty schema, the input should be `{}` rather than
`undefined`.

### 2. Player commands should always have an actor

The current model is one player submits one command. Under that model,
`executeCommand(...)` and `discoverCommand(...)` should not accept a player
command without `actorId`.

If the engine eventually needs system-initiated actions, that should be modeled
explicitly rather than making all command contexts weak.

### 3. Current types are reflecting a weak ingress boundary, not the desired

contract

Today the engine uses one broad `Command` / `Discovery` shape everywhere:

```ts
type Command = {
  type: string;
  actorId?: string;
  input?: Input;
};
```

That shape is currently used for:

- raw executor ingress
- lifecycle contexts
- testing helpers
- replay helpers
- terminal client types

This is why command authors still see `command.actorId?` and `command.input?`
inside `validate()` and `execute()`.

## Codebase Findings

### Runtime execution currently passes raw command objects through unchanged

`executeCommand(...)` passes the incoming command directly into validation and
execution contexts:

- `packages/tabletop-engine/src/runtime/game-executor.ts`
- `packages/tabletop-engine/src/runtime/contexts.ts`

There is currently no schema-based parsing, normalization, or strict request
typing between ingress and command lifecycle methods.

### `commandSchema` is not currently used to make lifecycle input strict

The schema is used for:

- command authoring types
- protocol description
- AsyncAPI generation

It is not used today to turn `input?: T` into `input: T` for command execution.

### AsyncAPI is already mostly aligned for command input

Current AsyncAPI generation already emits `input` as required for command
submission, but still marks `actorId` as optional. Discovery still emits both
`actorId` and `input` as optional.

Files:

- `packages/tabletop-engine/src/protocol/asyncapi.ts`

### Example consumers currently work around the weak types

Splendor commands still need non-null assertions such as:

- `command.actorId!`
- `command.input!`

because the engine lifecycle types expose the raw optional request shape.

## Recommended Design

Split the request model into two layers.

### 1. Strict player request types

Introduce strict request types for engine execution and discovery:

```ts
type PlayerCommand<Input> = {
  type: string;
  actorId: string;
  input: Input;
};

type PlayerDiscovery<Input> = {
  type: string;
  actorId: string;
  input: Input;
};
```

These should become the types used by:

- `ValidationContext`
- `ExecuteContext`
- `DiscoveryContext`
- `InternalValidationContext`
- `InternalExecuteContext`
- `InternalDiscoveryContext`
- `GameExecutor.executeCommand(...)`
- `GameExecutor.discoverCommand(...)`

### 2. Remove the loose request shape from the core execution path

The current weak `Command` / `Discovery` shape should no longer be used for
player command execution or discovery.

Options:

- rename the current broad shapes to make them clearly raw/legacy
- or delete them if no public caller still needs them

Directionally, the strict request type should become the default meaning of
`Command` and `Discovery`, because that is the contract the engine wants.

### 3. Keep command availability separate for now

`listAvailableCommands(...)` can remain actor-parametrized without this change.
This redesign is specifically about submitted player actions and discovery
requests, not about availability listing.

### 4. Add executor runtime guards anyway

Even after tightening the TypeScript surface, the executor should still reject:

- missing `actorId`
- missing `input`

This is necessary for:

- plain JavaScript callers
- unsafe casts
- malformed external integration code

## Planned API Direction

### Desired command lifecycle experience

```ts
.validate(({ command }) => {
  command.actorId;
  command.input;
})
.execute(({ command }) => {
  command.actorId;
  command.input;
})
```

No non-null assertions should be needed.

### Desired discovery lifecycle experience

```ts
.discoverable({
  discoverySchema,
  discover({ discovery }) {
    discovery.actorId;
    discovery.input;
  },
})
```

## Affected Areas

### Core types

- `packages/tabletop-engine/src/types/command.ts`

Main work:

- introduce strict request types
- update lifecycle context generics to use them
- update internal command definition types to use them
- remove or rename now-misleading loose request aliases

### Runtime context builders

- `packages/tabletop-engine/src/runtime/contexts.ts`

Main work:

- update context constructors to require strict command/discovery requests

### Game executor

- `packages/tabletop-engine/src/runtime/game-executor.ts`

Main work:

- change `discoverCommand(...)` and `executeCommand(...)` signatures
- add runtime rejection guards for missing `actorId` / `input`

### Protocol generation

- `packages/tabletop-engine/src/protocol/asyncapi.ts`

Main work:

- make `actorId` required for command submission
- make both `actorId` and `input` required for discovery requests
- make discovery result / rejection envelopes require `actorId` if discovery
  requests require it

### Tests

Likely affected:

- `packages/tabletop-engine/tests/types.test.ts`
- `packages/tabletop-engine/tests/kernel-execution.test.ts`
- `packages/tabletop-engine/tests/protocol.test.ts`
- `packages/tabletop-engine/tests/asyncapi.test.ts`
- replay/harness tests that currently use the loose `Command` type

### Example consumers

Likely affected:

- `examples/splendor/src/commands/*`
- `examples/splendor-terminal/src/types.ts`
- `examples/splendor-terminal/src/session.ts`

Expected payoff:

- remove many `!` assertions in command execution/discovery code

## Migration Strategy

This should be treated as a non-backward-compatible cleanup.

Recommended sequence:

1. Introduce the strict request types and rewire lifecycle contexts to use them.
2. Change `GameExecutor.executeCommand(...)` and `discoverCommand(...)` to
   accept the strict request types.
3. Add executor runtime guards for malformed requests.
4. Update AsyncAPI generation to match the stricter wire contract.
5. Update engine tests.
6. Update Splendor and `splendor-terminal`.
7. Remove or rename the old loose request types so they are not mistaken for the
   engine’s main execution contract anymore.

## Non-Goal

This change does **not** attempt to introduce full runtime schema validation or
input coercion. It only tightens the request contract so the engine and command
authors stop working against optional `actorId` / `input` for normal player
commands.
