# Client/Server Interaction Design

This document records the current direction for how `tabletop-kernel` should fit into a hosted client/server architecture.

The guiding principle is:

- one authoritative host contract
- one generated client contract
- one transport model
- local and remote play differ only by which host the client connects to

## Current Direction

The current direction is:

- use a single authoritative host model
- use WebSocket as the main interaction transport
- use AsyncAPI to describe the remote client/server contract
- use the same generated client for both remote online play and local play
- in local play, start a local loopback authoritative server and point the same client to it

This means the client side does not need a separate local-mode protocol or a second client generator.

## Why This Direction Was Chosen

The main reason is consistency.

If the project already intends to generate clients from a formal contract, then using one generated client everywhere is the cleanest architecture.

That gives:

- one client contract
- one transport mental model
- one update-envelope model
- one set of generated client libraries
- less branching in UI/client code

The local-versus-remote distinction becomes:

- remote mode: connect to a remote authoritative server
- local mode: connect to a local authoritative server started on the same machine

## Core Model

The deeper abstraction is not "HTTP versus WebSocket."

The deeper abstraction is:

- there is one authoritative host
- clients never mutate canonical state directly
- clients submit commands to the authoritative host
- the authoritative host executes commands and sends back updates

The chosen transport for that host interaction is WebSocket.

## Transport Decision

The interaction model should use WebSocket rather than an HTTP request/response API as the primary client-facing transport.

Reason:

- the host needs bidirectional communication
- the host needs to push state updates, committed events, and visible pending choices
- the same socket can naturally support:
  - command submission
  - reconnect/update flows
  - spectator updates
  - live game state changes

This avoids splitting the main interaction model across:

- one protocol for commands
- another protocol for subscriptions

## Contract Description Decision

The remote host contract should be described using AsyncAPI.

Reason:

- the chosen transport is WebSocket
- the system is message-oriented rather than purely request/response
- AsyncAPI is the best formal fit for describing:
  - channels
  - message shapes
  - update envelopes
  - bidirectional interaction patterns

The role of AsyncAPI here is:

- define the authoritative host protocol
- generate consistent clients
- keep remote integrations stable across languages

## Local Play Decision

Local play should still use the same generated client.

To make that possible:

- local mode should boot a local authoritative server
- the generated client should connect to that local server
- switching between local and remote play should mainly be a matter of changing the server address

This means:

- no special local-only protocol
- no separate local client generator
- no separate in-process client contract

The same message flow should exist in both modes.

## What "Local Mode" Means Under This Model

Under this model, local mode is still hosted mode.

The only difference is where the host runs:

- remote mode: the host runs on another machine or service
- local mode: the host runs on the same machine as the UI

So the architecture remains consistent:

1. player interacts with UI
2. UI uses the generated client
3. generated client sends command over WebSocket
4. authoritative host executes the command
5. authoritative host emits the resulting updates
6. generated client receives the updates and the UI re-renders

That flow is identical in local and remote modes except for the connection address.

## Benefits

### Consistent client architecture

The client code does not need a separate local-play path.

### No second client generator

AsyncAPI-generated clients can serve both deployment modes.

### Better parity between local and remote behavior

Local play and online play exercise the same interaction path.

### Easier future multi-language support

Because the same protocol contract applies in both modes, language-specific clients remain aligned.

### Cleaner long-term product architecture

Pass-and-play, bots, online play, and spectators can all fit under the same hosted interaction model.

## Costs

This direction does have real costs:

- local mode is heavier than a pure in-process function-call model
- a local host process or local server lifecycle must be managed
- local debugging includes transport startup and connection handling
- simple offline play inherits some hosted-architecture overhead

These costs are accepted because consistency is being prioritized over the lightest local-only setup.

## State and Update Model

The authoritative host should remain responsible for:

- canonical `{ game, runtime }` state
- command validation and execution
- viewer-specific outbound updates
- reconnect snapshots
- live update envelopes

The client should be responsible for:

- sending commands
- receiving updates
- rendering the visible state
- handling local UX around pending choices and command submission

## Recommended Update Shape

The exact AsyncAPI schema is still open, but the host should likely support message categories like:

- command submission
- command acceptance/rejection
- viewer-specific state snapshot
- incremental match update
- visible committed events
- visible pending choices
- reconnect or resync messages

The exact names can be decided later, but the important point is:

- one coherent WebSocket protocol should carry the authoritative host interaction

## Relationship To Persistence

This interaction model works naturally with the persistence-adapter direction.

The server flow should be:

1. receive command over WebSocket
2. execute against a working state
3. persist if the match is persistence-backed
4. only after persistence succeeds, publish the resulting committed update

That keeps the transport layer aligned with the authoritative commit model.

## Relationship To Replay

Because the authoritative host owns execution, it can also own the live generation of:

- accepted command records
- snapshots/checkpoints
- committed events
- replay artifacts

That fits well with a centralized host model and reduces ambiguity about what actually happened.

## What The Kernel Should Eventually Support

To support this direction cleanly, the broader ecosystem around `tabletop-kernel` should eventually support:

- a formal authoritative host contract
- AsyncAPI generation or source-of-truth schemas for the WebSocket protocol
- generated clients for supported languages
- local authoritative host bootstrapping for pass-and-play and bots
- remote authoritative host deployment for online play

The kernel itself should remain transport-agnostic, but the ecosystem around it should make this hosted model easy to adopt.

## Open Questions

The main remaining open questions are:

- what the exact AsyncAPI channel/message structure should look like
- whether command submission and updates should share one socket or multiple channels
- how reconnect snapshots should be represented in the live protocol
- how viewer-specific visibility filtering should be expressed once that subsystem is revisited
- how much of the authoritative host package should live in `tabletop-kernel` versus companion packages
