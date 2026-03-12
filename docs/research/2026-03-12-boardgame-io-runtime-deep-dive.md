# boardgame.io Runtime Deep Dive for tabletop-kernel

## Purpose

This document studies the `boardgame.io` runtime as a reference point for building `tabletop-kernel`: a reusable, transport-agnostic runtime for board-game rules engines. The focus here is the pure runtime and business-logic layer, not the client, server, lobby, or transport stack.

The target question is not "how do we clone `boardgame.io`?" It is "which runtime ideas are reusable, which assumptions should be rejected, and which missing concepts must be added so an autonomous coding agent can build rule engines on top of a stable kernel instead of re-creating infrastructure every time?"

## Scope

Included:

- reducer and state lifecycle
- turns, phases, stages, and active players
- move processing and validation
- lifecycle events and automatic transitions
- randomness and determinism
- hidden information filtering
- serialization constraints
- logs, patches, replay, and undo/redo
- testing hooks and deterministic helpers

Excluded:

- client rendering APIs
- server transport, auth, storage, and lobby features
- UI examples

## Primary Source Map

The most relevant runtime files in `boardgame.io` are:

- `/home/vincent-bai/Documents/github/boardgame.io/src/core/initialize.ts:16` - initial state construction
- `/home/vincent-bai/Documents/github/boardgame.io/src/core/game.ts:44` - config normalization and move wrapping
- `/home/vincent-bai/Documents/github/boardgame.io/src/core/reducer.ts:233` - main reducer
- `/home/vincent-bai/Documents/github/boardgame.io/src/core/flow.ts:41` - turn / phase / stage orchestration
- `/home/vincent-bai/Documents/github/boardgame.io/src/core/turn-order.ts:22` - active-player and turn-order helpers
- `/home/vincent-bai/Documents/github/boardgame.io/src/plugins/main.ts:35` - plugin pipeline
- `/home/vincent-bai/Documents/github/boardgame.io/src/plugins/events/events.ts:57` - lifecycle-event queue
- `/home/vincent-bai/Documents/github/boardgame.io/src/plugins/random/random.ts:48` - deterministic PRNG API
- `/home/vincent-bai/Documents/github/boardgame.io/src/master/filter-player-view.ts:20` - hidden-information filtering for outbound state
- `/home/vincent-bai/Documents/github/boardgame.io/src/testing/mock-random.ts:16` - deterministic random override for tests

## 1. Runtime Architecture and State Pipeline

### How it works

`boardgame.io` is fundamentally a reducer-driven state machine. The runtime is not built around domain objects, actors, or a general event bus. Instead:

1. `InitializeGame` builds an initial `State` with `G`, `ctx`, plugin state, and bookkeeping like `_undo`, `_redo`, and `_stateID` (`initialize.ts:16`).
2. `ProcessGameConfig` normalizes the game config, creates a `flow` object, and builds a wrapped `processMove` function (`game.ts:44-92`).
3. `CreateGameReducer` handles move actions, framework event actions, undo/redo, plugin actions, and patches (`reducer.ts:233-529`).
4. `Flow` owns the logic that mutates `ctx` over time: turns, phases, stages, automatic endings, and flow events (`flow.ts:41-899`).
5. Plugins inject APIs before a move or hook runs and flush persistent plugin data afterward (`plugins/main.ts:113-295`).

The core state shape lives in `/home/vincent-bai/Documents/github/boardgame.io/src/types.ts`. The important parts are:

- `G`: user-managed game state
- `ctx`: framework-managed control state
- `plugins`: persistent plugin data plus ephemeral plugin APIs
- `deltalog`: per-action log entries
- `_undo`, `_redo`: time-travel stacks
- `_stateID`: monotonic version number for stale-update detection

This means `boardgame.io` treats gameplay as a sequence of pure-ish reducer updates around a single authoritative state object.

### Key files and functions

- `InitializeGame` in `src/core/initialize.ts:16`
- `ProcessGameConfig` in `src/core/game.ts:44`
- `CreateGameReducer` in `src/core/reducer.ts:233`
- `Flow` in `src/core/flow.ts:41`
- plugin pipeline in `src/plugins/main.ts:35-301`

### Keep for tabletop-kernel

- A single authoritative runtime state object with explicit runtime-managed metadata.
- A clean separation between user game state and runtime control state.
- Deterministic action processing through a reducer-like pipeline.
- A plugin or middleware system for cross-cutting runtime services.

### Avoid for tabletop-kernel

- Coupling all orchestration to a Redux-style action shape.
- Mixing "game semantics" and "transport/update semantics" in the same reducer surface.
- Treating lifecycle control as only `ctx` mutation. Some future capabilities, like triggered abilities and stack resolution, deserve first-class runtime subsystems rather than more `ctx` fields.

### Needed beyond boardgame.io

- A first-class runtime command model distinct from transport actions.
- Separate internal queues for lifecycle actions, triggered abilities, and resolution stacks.
- Stronger type boundaries around runtime state, hidden zones, and deterministic effects.
- A replay/simulation API that is designed as a core runtime concern instead of emerging from reducer internals.

## 2. Turn, Phase, Stage, and Active-Player Progression

### How it works

Flow progression is implemented in `src/core/flow.ts` and `src/core/turn-order.ts`.

`Flow` normalizes the game config and produces wrapper functions for game hooks (`onBegin`, `onEnd`, `endIf`, `turn.onMove`, and so on). It then exposes methods that:

- initialize the game flow
- process moves for automatic transitions
- process lifecycle events like `endTurn`
- answer whether a move is available
- answer whether a player is active

The core flow engine is the internal `Process` loop in `flow.ts:200`. It processes a queue of pending transition functions. Each transition function can push more work into `next`, and the loop also checks automatic endings after each step:

- `ShouldEndGame`
- `ShouldEndPhase`
- `ShouldEndTurn`

This is important: `boardgame.io` already has a queue, but it is a narrow lifecycle queue, not a general stack/event bus.

Turn order is built in `turn-order.ts`:

- `SetActivePlayers` (`:22`) constructs the active-player map and min/max move limits.
- `UpdateActivePlayersOnceEmpty` (`:156`) restores previous active-player sets or applies queued next states.
- `InitTurnOrderState` (`:252`) initializes `playOrder`, `playOrderPos`, and `currentPlayer`.
- `UpdateTurnOrderState` (`:287`) advances turn order or ends the phase when `order.next` returns `undefined`.
- `TurnOrder` (`:356`) provides reusable order policies like `DEFAULT`, `RESET`, `CONTINUE`, `ONCE`, and `CUSTOM`.

Stages are not an independent subsystem. They are expressed as per-player labels inside `ctx.activePlayers`, plus extra counters for min/max move tracking. Ending a stage eventually mutates `activePlayers`, maybe applies `stage.next`, and may restore previous active-player sets.

### Key files and functions

- `Flow` setup and wrappers: `src/core/flow.ts:41-198`
- queue processor: `src/core/flow.ts:200-294`
- `StartPhase`, `StartTurn`, `UpdateTurn`, `EndPhase`, `EndTurn`, `EndStage`: `src/core/flow.ts:301-669`
- `SetActivePlayers`, `UpdateActivePlayersOnceEmpty`, `InitTurnOrderState`, `UpdateTurnOrderState`: `src/core/turn-order.ts:22-353`

### Keep for tabletop-kernel

- Explicit, inspectable progression state.
- Reusable turn-order policies.
- Active-player support for simultaneous or staged interactions.
- Automatic transition checks after moves and lifecycle steps.

### Avoid for tabletop-kernel

- Encoding stages as mostly ad hoc string tags inside `ctx`.
- Hiding too much progression complexity in one large `Flow` module.
- Conflating "whose turn is it" with "who may currently act" and "what resolution layer is active."

### Needed beyond boardgame.io

- First-class phase/step/priority abstractions for games with interrupt windows.
- Better support for nested timing windows and multi-step atomic procedures.
- A clearer model for simultaneous reveals, bids, simultaneous programming, and secret simultaneous commitments.
- A runtime scheduler that can represent both turn structure and resolution structure.

## 3. Move Execution, Validation, and Action Lifecycle

### How it works

Moves are discovered and wrapped in `ProcessGameConfig` (`game.ts:44-92`). `flow.getMove` resolves whether a move is available in the current context:

1. stage move set
2. phase move set
3. global move set

The main move path is in `CreateGameReducer`, `case Actions.MAKE_MOVE` (`reducer.ts:311-417`):

1. Reset `deltalog`.
2. Resolve the move with `game.flow.getMove`.
3. Reject unavailable, inactive, or post-game actions.
4. Enhance plugin APIs into state via `plugins.Enhance`.
5. Call `game.processMove`.
6. If the move returns `INVALID_MOVE`, reject it.
7. If client-side and any plugin says `noClient`, discard the speculative update.
8. On the server path, create the initial log entry, then call `game.flow.processMove` so post-move hooks and automatic turn/phase/game endings can run.
9. Flush plugins and validate.
10. Update undo/redo and bump `_stateID`.

The actual move execution inside `game.processMove` wraps the move with plugin wrappers via `plugins.FnWrap` (`game.ts:83-100`, `plugins/main.ts:97-110`). Core wrappers include:

- Immer wrapper for mutable authoring style (`plugin-immer.ts:17`)
- Random plugin injection (`plugin-random.ts:13`)
- Log plugin injection (`plugin-log.ts:24`)
- Serializable check (`plugin-serializable.ts:37`)
- Events wrapper at the end (`plugin-events.ts:15`)

### What is elegant here

- Move availability is centralized.
- Plugins can wrap moves and hooks consistently.
- Invalid moves have an explicit sentinel (`INVALID_MOVE` in `constants.ts:6`).
- The engine distinguishes between "move changed `G`" and "flow changed `ctx` afterward."

### Where it becomes limiting

- The lifecycle is implicitly split across reducer, flow, and plugins.
- Client/server concerns leak into the move model through `client: false` and `noClient`.
- There is no first-class distinction between commands, effects, triggers, and state mutations.

### Keep for tabletop-kernel

- Central move availability resolution.
- A predictable pre-run / run / post-run pipeline.
- Explicit invalid-action signaling.
- Hook wrapping for runtime services like randomness or logging.

### Avoid for tabletop-kernel

- Making runtime core depend on client-vs-server branching.
- Having moves directly mutate `G` while hidden services also smuggle side effects through plugin APIs.
- Treating all non-move control flow as implicit aftermath of reducer execution.

### Needed beyond boardgame.io

- First-class effect records, not only post hoc log entries.
- A command pipeline that can stage validation, permission checks, execution, trigger collection, and resolution as separate phases.
- Support for engine-managed action windows, costs, replacement effects, and interrupts.

## 4. Events and Triggered State Transitions

### How it works

`boardgame.io` events are framework-provided lifecycle operations, not a general publish/subscribe bus.

The event API is defined in `src/plugins/events/events.ts`. The main public calls are:

- `endGame`
- `endPhase`
- `endStage`
- `endTurn`
- `pass`
- `setActivePlayers`
- `setPhase`
- `setStage`

The events plugin works in two layers:

1. `EventsPlugin` (`plugin-events.ts:15-37`) injects an `events` API into move and hook contexts and flushes queued calls with `dangerouslyFlushRawState`.
2. `Events` (`events.ts:57-173`) stores dispatched event requests, tracks which hook they were called from, and later converts them into automatic game events processed by `flow.processEvent`.

The critical behavior is queueing:

- Calling `events.endTurn()` inside a move does not end the turn immediately.
- The call gets appended to `dispatch` in `Events.api()` (`events.ts:85-99`).
- On plugin flush, `Events.update()` (`events.ts:124-173`) validates whether the event was called from an allowed hook and then turns it into `automaticGameEvent(...)`.
- `flow.processEvent` (`flow.ts:857-860`) hands off to specific handlers like `EndTurnEvent`, `EndPhaseEvent`, or `SetActivePlayersEvent`.

This is a disciplined queue, but it only covers framework lifecycle events. There is no generic event bus where game code can subscribe to "card drawn", "unit died", or "damage assigned" and produce triggered abilities with priorities.

### Triggered abilities in boardgame.io

There is no dedicated triggered-ability subsystem. Authors usually emulate triggers using:

- `endIf` checks
- `turn.onMove`
- phase or turn hooks
- ad hoc move code that manually calls more events

That works for simple games, but it does not model:

- trigger detection vs trigger resolution
- multiple simultaneous triggers
- APNAP or priority ordering
- replacement effects
- interrupt windows
- stack-based responses

### Keep for tabletop-kernel

- Queueing lifecycle transitions instead of mutating control state in-place from arbitrary code.
- Validating which lifecycle operations are legal in which hooks.
- Treating automatic transitions as explicit runtime work items.

### Avoid for tabletop-kernel

- Calling this subsystem an "event bus" when it is really a constrained lifecycle queue.
- Encoding all trigger behavior as hook code and `endIf` checks.
- Using one queue for everything without explicit priority, ownership, or timing windows.

### Needed beyond boardgame.io

- A real internal event bus for domain events emitted by the rules engine.
- Separate trigger detection and trigger resolution phases.
- Support for multiple pending triggers, ordering rules, and optional player choices.
- Optional stack/queue resolution models depending on the game family.
- Replacement/prevention effect interception before state mutation finalization.

## 5. Randomness and Deterministic Simulation

### How it works

Randomness is implemented as a core plugin:

- `RandomPlugin` in `src/plugins/plugin-random.ts:13-34`
- `Random` in `src/plugins/random/random.ts:48-166`

The persistent random state stores:

- `seed`
- `prngstate`

The random API exposes `D4`, `D6`, `D8`, `D10`, `D12`, `D20`, `Die`, `Number`, and `Shuffle`.

The important design decision is that PRNG state is persisted in runtime state, not hidden in ambient process memory. `_random()` (`random.ts:83-99`) advances the Alea PRNG and stores the new `prngstate`, which preserves determinism across replays.

The plugin’s `noClient` implementation returns true if randomness was used during the move (`plugin-random.ts:16-19`). That means speculative client-side execution should be discarded and replaced by the authoritative server result.

### Determinism characteristics

Good:

- seedable
- replayable if action order is known
- pure from the reducer’s perspective because PRNG state is serialized

Less good:

- the model is still shaped around client/server secrecy rather than a pure simulation API
- random access patterns are implicit in move code, making "what random events happened" harder to inspect as first-class effects

### Testing support

`MockRandom` (`src/testing/mock-random.ts:16-25`) creates a plugin that overrides selected random API methods. The tests in `src/testing/mock-random.test.ts:16-40` show both deterministic override and seeded fallback behavior.

### Keep for tabletop-kernel

- Persisting PRNG state in serializable runtime state.
- A runtime-provided random API instead of direct `Math.random()`.
- Seeded deterministic simulation.
- Mockable random providers for tests.

### Avoid for tabletop-kernel

- Making deterministic behavior depend on client/server materialization rules.
- Hiding random draws only as opaque side effects inside moves.

### Needed beyond boardgame.io

- First-class random effect records in replay logs.
- Named RNG streams or scoped PRNGs for subsystems like shuffling, AI sampling, or procedural setup.
- Controlled reveal semantics for secret draws and hidden random outcomes.
- Deterministic simulation APIs built for exhaustive testing and AI rollouts, not just client replay safety.

## 6. Hidden Information and Player-Specific Views

### How it works

`boardgame.io` handles hidden information primarily by filtering authoritative state before it is sent outward.

There are two layers:

1. Game-level `playerView`, such as `PlayerView.STRIP_SECRETS` in `src/core/player-view.ts:14-39`
2. Plugin-level `playerView` hooks applied by `plugins.PlayerView` in `src/plugins/main.ts:297-314`

The outward filtering path is implemented in `src/master/filter-player-view.ts:20-71`:

- `applyPlayerView(...)` runs the game-level `playerView`
- plugin `playerView` hooks are applied
- `deltalog`, `_undo`, and `_redo` are stripped

The same file also redacts log arguments for moves marked `redact` (`filter-player-view.ts:75-104`). If a log entry is marked redacted and the receiving player is not the acting player, the log entry is preserved but `args` are replaced with `null`.

This is effective as an outbound-view filter, but it is not a deep hidden-information model inside the runtime. Secrets still live in the authoritative state shape and are hidden later.

### The `player` plugin

`plugin-player.ts:44-86` is a convenience plugin that keeps per-player data in `G.players` and offers a `player` API. This is a useful helper, but it is a convention, not a robust hidden-zone system.

### Keep for tabletop-kernel

- Explicit player-view filtering before exposing state.
- Support for plugin-specific hidden data policies.
- Redacted replay entries for secret moves.

### Avoid for tabletop-kernel

- Treating hidden information as a post-processing concern only.
- Baking hidden-state conventions into `G.secret` or `G.players`.
- Coupling secrecy to transport filtering logic.

### Needed beyond boardgame.io

- First-class hidden zones, ownership rules, and visibility policies inside the runtime.
- View derivation as a stable kernel capability, not a server-side afterthought.
- Better modeling for simultaneous hidden choices, partial knowledge, and information reveals over time.
- An audit trail that records both authoritative truth and each observer’s legal view.

## 7. Serialization and Serializability Constraints

### How it works

`boardgame.io` assumes game state must be JSON-serializable. The main explicit guard is `plugin-serializable.ts`.

`isSerializable(...)` (`plugin-serializable.ts:8-29`) recursively allows:

- `undefined`, `null`, booleans, numbers, strings
- plain objects
- arrays

Anything else fails. In non-production environments, `SerializablePlugin` (`plugin-serializable.ts:37-51`) throws if a move returns a non-serializable value.

This is pragmatic for multiplayer transport and persistence, but it is also restrictive:

- `Map`, `Set`, class instances, and custom value objects are effectively banned.
- The check only looks at move return values, not the entire semantic model of engine data.

### Keep for tabletop-kernel

- A strong bias toward serializable state.
- Runtime-level validation that catches accidental non-serializable mutations early.

### Avoid for tabletop-kernel

- Hiding serialization policy in a move wrapper plugin only.
- Assuming JSON is the only serialization target forever.

### Needed beyond boardgame.io

- A first-class codec boundary for snapshots, logs, and saved matches.
- Structured serialization policies for domain types rather than blanket rejection.
- Schema/version migration support for saved game compatibility.

## 8. Replay Logs, Deltalogs, Patches, and Undo/Redo

### How it works

Logging is spread across several pieces:

- `initializeDeltalog(...)` in `src/core/reducer.ts:103-128`
- `LogPlugin` in `src/plugins/plugin-log.ts:24-40`
- flow lifecycle logging in `src/core/flow.ts:491-588`
- patch application in `src/core/reducer.ts:515-528`
- player-view log redaction in `src/master/filter-player-view.ts:75-104`

For each move or undo/redo action, `initializeDeltalog` creates a log entry with:

- the action
- `_stateID`
- turn
- phase
- optional metadata from the log plugin
- optional `redact` marker

Lifecycle transitions like `endTurn`, `endPhase`, and `endStage` append additional log entries from inside `Flow`.

Undo/redo is snapshot-based, not log-replay-based:

- `updateUndoRedoState` stores full snapshots of `G`, `ctx`, and `plugins` (`reducer.ts:72-98`)
- `UNDO` restores the previous snapshot (`reducer.ts:418-469`)
- `REDO` restores the next snapshot (`reducer.ts:471-512`)

Patch support exists in the reducer (`reducer.ts:515-528`) and in player-view filtering where outbound state diffs are computed with `rfc6902.createPatch` (`filter-player-view.ts:24-35`). That is an update-transport optimization, not a first-class replay model.

### Important limitation

The replay story is partial:

- there is no dedicated replay subsystem
- deltalogs are action-oriented, not effect-oriented
- patch support exists, but patches are not the core source of truth
- log entries can be redacted, which is useful for secrecy but means replay from public logs is not enough

### Keep for tabletop-kernel

- Attaching metadata and redaction policy to log entries.
- Recording lifecycle transitions explicitly.
- Maintaining deterministic snapshots and action history.

### Avoid for tabletop-kernel

- Relying on reducer internals as the replay API.
- Using snapshot undo/redo as the only historical model.
- Mixing transport patches with semantic replay events.

### Needed beyond boardgame.io

- A first-class replay log that records domain events, random results, trigger creation, choices, and resolutions.
- Multiple log views: authoritative, per-player, and debugging.
- Deterministic rewind/replay APIs built into the kernel.
- Configurable history retention and snapshot checkpoints for long games.

## 9. Testing Support and Deterministic Harnesses

### How it works

`boardgame.io` provides useful building blocks, but not a deeply specialized runtime test harness for complex tabletop rules:

- moves are plain functions and easy to unit test
- seeded randomness gives deterministic sequences
- `MockRandom` overrides random APIs for targeted scenarios
- `flow.test.ts` exercises low-level progression behavior directly
- the docs recommend scenario tests through `Client`, which is more integration-flavored than kernel-flavored

The strongest runtime-friendly test helper in the inspected sources is `MockRandom`. The rest of the test strategy relies on:

- direct move invocation
- direct `Flow` invocation
- or full client setup

### Keep for tabletop-kernel

- Direct, low-level testability of rules and progression logic.
- Deterministic randomness controls.
- The idea that runtime internals should be testable without UI.

### Avoid for tabletop-kernel

- Making the main scenario-testing story depend on client wrappers.
- Leaving simulation harnesses as ad hoc combinations of reducer calls.

### Needed beyond boardgame.io

- A dedicated kernel test harness:
  - build state fixtures
  - submit commands/actions
  - inspect emitted events, triggers, random outcomes, and visibility slices
  - replay and branch simulations
- Golden-log testing for complex resolution chains.
- Deterministic branching for AI/self-play workloads.

## 10. What boardgame.io Does Not Directly Give You

These gaps matter because they align closely with `tabletop-kernel`'s goals.

### No general event bus

The events system is lifecycle-specific. It does not model arbitrary domain events and subscriptions.

### No triggered-ability engine

There is no native concept of:

- "when X happens, create trigger Y"
- trigger ordering windows
- optional triggers
- replacement/prevention layers

### No stack/priority system

There is no first-class support for:

- interrupts
- responses
- spell/ability stack resolution
- priority passing
- simultaneous trigger ordering by rules

### Hidden information is filtering, not ontology

Secrets are mostly modeled as normal state that gets filtered before exposure.

### Replay is good enough for framework logs, not for deep engine introspection

The runtime captures actions and some automatic transitions, but not a complete semantic explanation of why the state changed.

## 11. Recommended Direction for tabletop-kernel

### Runtime shape

`tabletop-kernel` should keep the idea of a deterministic authoritative runtime state, but separate it into clearer layers:

- game state
- control/progression state
- hidden-information state
- deterministic services state, such as RNG
- history/replay state
- pending work queues, such as triggers or stack items

### Event model

Use two distinct concepts:

1. Lifecycle commands
   - start turn
   - end turn
   - advance phase
   - resolve stack item

2. Domain events
   - card drawn
   - damage assigned
   - unit destroyed
   - clue discovered

Domain events should feed a trigger engine. They should not be collapsed into the same API as lifecycle transitions.

### Resolution model

Support pluggable resolution disciplines:

- no stack, just immediate resolution
- FIFO/LIFO effect queues
- full response stack with priority passing

Different game families need different machinery.

### Hidden information model

Make visibility part of the runtime model:

- zones and objects can declare visibility rules
- observers can derive legal views deterministically
- logs can be rendered differently per observer

### History model

Record semantic history, not just raw actions:

- submitted command
- validated effects
- random outcomes
- emitted domain events
- triggers created
- choices requested and made
- final committed state transition

### Test model

Provide a kernel-native harness from the start:

- create fixture state
- run one command
- run until quiescence
- inspect history, visibility, and pending stack/queue state
- serialize, deserialize, and replay

## 12. Keep / Avoid Summary

Keep:

- deterministic state pipeline
- seed-based RNG with persisted PRNG state
- explicit turn-order helpers
- plugin/extensibility hooks
- redacted per-player log/state views
- invalid-action signaling

Avoid:

- reducer surface that mixes engine semantics with transport semantics
- hidden information as only a final filtering pass
- overloading lifecycle events as a general event system
- relying on ad hoc hooks for triggered-ability logic
- treating patch transport as replay architecture

Build beyond:

- internal event bus
- triggered-ability engine
- stack/queue resolution subsystem
- first-class hidden zones and observer views
- semantic replay logs
- deterministic simulation/test harness as core product features

## Closing Assessment

`boardgame.io` is a strong reference for deterministic turn/phase orchestration, runtime-managed randomness, and the practical mechanics of hiding state from clients. It is less suitable as a direct blueprint for a reusable autonomous-rules-engine kernel because its architecture is optimized around a reducer-plus-framework model with client/server concerns nearby.

For `tabletop-kernel`, the right move is to borrow the deterministic execution discipline and some of the progression primitives, but elevate events, triggers, visibility, replay, and resolution into first-class engine subsystems rather than extending the `boardgame.io` `ctx`/hook pattern further.
