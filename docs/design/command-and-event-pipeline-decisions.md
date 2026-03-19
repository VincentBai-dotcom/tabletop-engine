# Command and Event Pipeline Decisions

This is a living design document for the command and event pipeline topic.

Update this file whenever a command/event-pipeline design decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

### Command and event separation

Commands and events should be treated as two distinct first-class concepts from the beginning.

Definition:

- a command is an attempted intentional input
- an event is a fact that has already happened

Implication:

- commands can be validated, accepted, or rejected
- events represent accepted past-tense state changes or engine facts
- triggers should generally react to events rather than to attempted commands

Rationale:

- keeps request/validation separate from factual outcomes
- makes trigger design clearer
- improves replay/history semantics

External command vs internal engine-step distinction

Commands should remain distinct from engine-internal scheduled work.

Boundary:

- command = intent submitted into the engine from outside
- internal engine step = follow-up work scheduled by the engine while processing accepted execution

Important clarification:

- the consumer may define the rules or policies that cause internal engine work to be scheduled
- but once scheduled during execution, that work is still engine-internal rather than an external command

Examples:

- external command: `PlayCard`, `Pass`, `EndTurn`, `ChooseOption`
- internal engine step: advance progression, resolve pending trigger, apply automatic end-turn, continue queued resolution

Rationale:

- preserves a clearer API and audit boundary
- avoids treating engine housekeeping as if it were external intent
- improves replay readability and debugging

Committed-fact event decision:

- canonical events should represent accepted or committed facts only

Implication:

- rejected or invalid attempts should not become part of the canonical event stream by default
- rejection information should be returned through execution results or diagnostics instead of committed game events

Legality boundary:

- legality rules are consumer-defined rather than inferred generically by the kernel
- the kernel enforces legality by calling consumer-provided rule logic rather than deducing all legal moves from first principles
- action discovery may be supported later if exposed through consumer-defined contracts, but it should not be assumed as something the kernel can infer automatically for every game

Rationale:

- keeps the canonical event stream focused on committed game facts
- respects the boundary that game legality belongs to consumer-defined rules
- avoids overpromising generic legal-action deduction that may not exist for all games

Primary committed-event direction:

- a successful external command should produce one primary committed event by default

Implication:

- the event layer should stay simple and readable
- events are currently being treated more as visibility, debugging, and replay-facing facts than as a complex gameplay-mechanics substrate
- if richer multi-event behavior is needed later, it can be added deliberately rather than assumed from the start

Status:

- direction chosen for simplicity
- may be revisited later if trigger/resolution design creates a strong need for richer committed-event fan-out

Rationale:

- keeps the event model easier to understand
- makes history/debug output easier to read
- avoids unnecessary complexity in the first pipeline design

Internal engine-step event direction:

- internal engine steps should also emit committed events by default

Implication:

- visibility, debugging, and testing should be able to observe important engine-driven state changes, not only externally initiated command results
- committed history should reflect meaningful automatic progression and resolution steps as well as player-initiated outcomes

Rationale:

- improves observability of automatic engine behavior
- makes replay/debug traces easier to inspect
- helps explain why state changed even when no new external command was submitted

Hybrid event-functionality direction:

- committed events should be meaningful engine facts that can support actual engine functionality such as triggers
- events should not become the sole mutation mechanism of the engine

Implication:

- the engine should not rely on a second hidden trigger substrate separate from committed facts
- triggers and automatic reactions may respond to committed events
- events should still remain lighter-weight than a fully event-sourced architecture

Rationale:

- purely observational events are too weak for event-triggered tabletop rules
- a fully event-sourced design is likely too heavy for the first kernel version
- the hybrid model keeps one meaningful notion of “what happened” without over-engineering the execution model

Hybrid event-emission direction:

- event emission should use a hybrid model of kernel-emitted runtime events plus consumer-declared explicit event emission

Implication:

- the kernel should emit important runtime facts on its own where the engine semantics require them
- the consumer should also be able to declare meaningful domain-specific events as part of rule execution
- the engine should not rely solely on kernel-detected generic state diffs to infer all meaningful events

Consumer-facing use:

- consumers may attach domain-specific event identities to rule actions so that later rules or triggered effects can react to those committed facts explicitly

Rationale:

- some events are intrinsic to kernel/runtime behavior
- some events are domain-specific and can only be named meaningfully by the consumer
- pure state-diff detection is too weak to recover full game semantics in a generic way

Primary and secondary committed-event direction:

- a successful execution may produce one primary committed event plus optional secondary committed events

Important clarification:

- primary versus secondary is about semantic importance within the execution outcome, not about whether the event came from the kernel or from consumer-defined rule logic
- committed events should describe meaningful domain or runtime facts rather than raw state-diff fragments

Implication:

- secondary events should represent additional meaningful committed facts produced during the same execution
- the event model should not devolve into automatically exposing arbitrary field-level state changes as events

Rationale:

- keeps events semantic rather than diff-shaped
- preserves a readable history/debug trace
- allows richer event output without collapsing into low-level state-change noise

Atomic execution direction:

- accepted execution should run atomically to quiescence before returning

Implication:

- once a command or internal engine step is accepted, the engine should continue processing resulting internal work until no further required immediate pipeline work remains
- the caller should not receive control back while required committed follow-up work is still pending

Rationale:

- safer default for correctness
- reduces partially-resolved engine states leaking to hosts or clients
- keeps the first kernel version easier to reason about

Sequential pipeline direction:

- single-match pipeline execution should be strictly sequential for v1

Implication:

- one accepted command or internal engine step should be fully processed before the next begins
- concurrency, if needed later, should be treated as a host-level concern across separate matches or simulations rather than as interleaved execution inside one match pipeline

Rationale:

- matches tabletop ordering expectations better
- preserves deterministic ordering and replay clarity
- avoids unnecessary ambiguity in trigger and resolution ordering

Nested command submission decision:

- rules should not submit nested commands during execution in v1

Implication:

- follow-up work should be modeled through shared rule helpers, committed events, and engine-scheduled continuation work rather than reentrant command submission
- the pipeline should avoid reentrancy caused by command submission from inside active execution

Rationale:

- keeps audit boundaries clearer
- reduces reentrancy complexity
- makes validation and replay behavior easier to reason about

Internal-step validation direction:

- internal engine steps should bypass normal external-command validation

Implication:

- external commands remain the main place where legality and permission validation occurs
- internal engine steps may still use engine invariants or assertions where needed, but should not be treated as untrusted requests going through the full external validation path

Rationale:

- scheduled continuation work is engine-trusted work
- avoids unnecessary duplication of command-style validation
- keeps the pipeline simpler while still allowing engine-safety checks

Command representation decision:

- commands should be plain serializable data objects

Implication:

- command behavior should live in separate command definitions or handlers rather than on behavior-bearing command instances
- command payloads should remain portable across replay, test, host, and network boundaries

Rationale:

- keeps command payloads easy to serialize and inspect
- preserves cleaner replay and transport boundaries
- still allows interface enforcement at the command-definition layer

Command-definition contract direction:

- command definitions should require both `validate` and `execute`

Implication:

- every command type has an explicit legality gate
- commands that do not need meaningful validation may still provide a trivial validation result rather than relying on an implicit default

Rationale:

- keeps the command-definition contract uniform
- reduces ambiguity about whether validation was forgotten
- improves consistency for both human and agent-authored command definitions

Validation result direction:

- `validate` should return a structured result with reasons and metadata, not only a simple pass/fail value
- prefer an object-shaped result rather than a positional tuple

Implication:

- validation failures can carry debugging-oriented explanation and supporting metadata
- hosts or apps are not required to treat that validation metadata as part of their user-facing product behavior

Rationale:

- improves debugging and development-time visibility
- fits the existing boundary where diagnostics are returned out-of-band rather than stored in canonical state
- keeps room for richer tooling without complicating canonical engine semantics

Execute-surface direction:

- `execute` should be allowed to directly mutate `game`
- `execute` should also be allowed to request kernel actions through a controlled API

Allowed kernel-facing requests may include:

- emitting domain-specific committed events
- requesting progression-related engine work
- scheduling internal engine steps

Boundary:

- `execute` should not directly mutate `runtime`
- engine-level effects should go through explicit kernel-controlled APIs rather than direct runtime writes

Rationale:

- some rule outcomes require engine-level follow-up beyond plain game-state mutation
- preserves the runtime ownership boundary already chosen for the state model
- gives consumers enough power to express real tabletop effects without exposing raw runtime mutation

Ordered in-transaction kernel-request direction:

- kernel-facing requests made during execution should preserve the order they are declared within the same atomic execution

Implication:

- kernel requests should not be treated as a vague later phase that runs only after all ordinary game mutations have already happened
- rule logic should be able to express ordered sequences of game mutation and kernel-requested work within one execution transaction
- the engine should mediate those requests through a controlled ordered trace rather than exposing direct raw runtime mutation

Rationale:

- preserves rule-authored ordering semantics
- avoids accidental reordering between game mutation and engine-level work
- keeps the benefits of controlled kernel mediation without breaking expected execution order

Phase-specific context direction:

- `validate` and `execute` should receive different context surfaces

Implication:

- `validate` should receive a read-oriented context appropriate for legality checks
- `execute` should receive the richer execution context that allows game mutation and controlled kernel requests

Rationale:

- keeps phase boundaries clearer
- reduces accidental misuse of mutation-capable APIs during validation
- makes the pipeline easier to understand for both humans and agents

Execution-metadata visibility direction:

- both `validate` and `execute` should be able to inspect relevant current execution metadata, not just raw game state

Examples of relevant metadata:

- active actor
- current progression context
- current resolving source or origin
- other kernel-provided execution metadata needed to interpret legality or apply effects correctly

Boundary:

- `validate` may inspect execution metadata through a read-oriented context
- `execute` may also inspect the same kind of metadata, in addition to its mutation-capable and kernel-request APIs

Rationale:

- many games cannot validate legality without current actor or progression context
- effect application often depends on execution metadata, not only raw game state
- visibility of metadata does not require exposing direct runtime mutation

Unified event-stream direction:

- committed events should live in one unified ordered event stream
- each event should carry explicit category and type fields

Typing direction:

- event typing should still use discriminated unions at the TypeScript level

Implication:

- replay, history, and debugging can reason about one ordered stream rather than multiple separate event collections
- category fields keep kernel/runtime events and consumer/domain events distinguishable without splitting the stream itself

Rationale:

- preserves ordering clarity
- keeps runtime structure simple
- retains strong TypeScript typing and narrowing

Pending-choice direction:

- commands that require later user choices should be supported as a first-class pattern in v1

Implication:

- the kernel should be able to represent pending required choices as part of engine semantics rather than relying on UI-only orchestration
- multi-step interactions such as modal choices, search/select flows, and other required follow-up decisions should not be treated as merely app-level concerns

Rationale:

- keeps important game sequencing and legality in the kernel
- improves replay, multiplayer synchronization, and deterministic behavior
- avoids pushing too much semantic workflow into ad hoc consumer UI code

Pending-choice representation direction:

- pending required choices should be represented as a distinct first-class choice/prompt concept

Implication:

- pending choices should not be treated merely as a special kind of automatic continuation work
- the pipeline should acknowledge that some engine states wait for outside input rather than continuing automatic internal work

Rationale:

- pending choices are blocking interaction points with different semantics from ordinary automatic continuation work
- a dedicated concept makes the pipeline easier to reason about
- avoids awkwardly modeling external input waits as if they were just more automatic engine work

Choice-response input direction:

- pending choices should be answered through normal external commands rather than through a separate external input channel

Implication:

- the engine has one unified external input pipeline for both ordinary actions and responses to pending choices
- pending choice state remains a first-class engine concept, but responding to it does not require a second first-class input type

Developer experience:

- consumers define ordinary commands
- command execution may create pending choices/prompts
- later follow-up input such as `choose_option` or `choose_target` is submitted as normal command data and validated against the current pending choice state

Rationale:

- keeps the external input model simpler
- preserves one validation and replay path
- reduces cognitive overhead for consumers and hosts

Pending-choice blocking direction:

- pending choices should not impose a universal hard-coded blocking rule at the kernel level

Implication:

- the rules layer should be able to determine whether a given pending choice blocks all other external commands except answering it
- the rules layer should also be able to define cases where other commands remain legal while a choice is pending

Rationale:

- some games require strict modal prompts
- some games require response windows or other legal actions while a choice is pending
- this is a legality/timing question, not a concurrency question

Stable command-definition direction:

- v1 command definitions should be registered up front as stable command definitions

Implication:

- the rules layer should not rely on creating ad hoc runtime command types in v1
- the engine should still avoid architectural choices that would make future dynamic command registration impossible if later games genuinely need it

Rationale:

- most tabletop and card games can likely be modeled without runtime-created command types
- keeps the first command pipeline simpler
- preserves an escape hatch for future mechanics that may need more dynamic command registration

Stable event-type direction:

- v1 event types should be declared up front as stable event definitions

Implication:

- consumers should be able to define their own domain event types
- the rules layer should not rely on inventing arbitrary brand-new event types during execution in v1
- the engine should still avoid architectural choices that would make future runtime event-type registration impossible if later games genuinely need it

Rationale:

- keeps event typing and trigger registration simpler in v1
- improves replay/debug expectations by keeping the event catalog more predictable
- mirrors the same pragmatic approach already chosen for command definitions

Event payload weight direction:

- committed events should stay lightweight and semantic by default
- events should not carry full before/after state snapshots or diffs by default

Implication:

- replay, snapshots, and state-diff handling remain engine concerns outside the core event payload model
- if debugging tooling later needs before/after inspection, it should come from execution metadata, history/snapshot systems, or dedicated debug tooling rather than from every canonical event payload

Rationale:

- preserves the semantic event model already chosen
- avoids bloating the event stream with duplicated state data
- keeps replay/history responsibilities separate from event payload design

Execution-result shape direction:

- command submission should return a rich execution result object rather than forcing consumers to reconstruct outcome details from separate channels

Implication:

- the engine should provide one authoritative result object for a single execution boundary
- that result can include the updated state, success or failure, committed events, pending choices, and validation or diagnostic metadata
- consumers can still ignore fields they do not care about, but they should not have to piece together one command's outcome from multiple sources

Rationale:

- gives tests, bots, agents, and hosts one coherent place to inspect what happened
- preserves the atomic execution boundary already chosen for the pipeline
- avoids ambiguity about which events, prompts, or diagnostics belong to a specific command submission

Expected-failure handling direction:

- ordinary expected command failure should return a normal execution result rather than throw

Implication:

- validation failure and similar rule-level rejection should return a rich result object with the canonical state and structured failure metadata
- the returned state should remain the unchanged pre-execution canonical state for those expected non-success cases
- unexpected engine failures, invariant violations, or consumer-rule bugs should still surface as fatal errors rather than being hidden inside ordinary rejection results

Rationale:

- preserves atomicity without forcing consumers to special-case state access on ordinary rejection
- keeps illegal or unavailable actions in the category of normal gameplay outcomes rather than program crashes
- still preserves loud failure for actual kernel or rule-code bugs

Action-discovery direction:

- action discovery should be treated as an important first-class capability, but not as one giant `getAllPossibleMoves()` API

Implication:

- the kernel should define discovery API contracts, contexts, and conventions
- consumers should implement the actual game-specific discovery logic rather than relying on the kernel to infer legal actions from `validate()`
- discovery should be structured and query-oriented, such as progressive queries over command inputs, targets, options, or pending-choice responses
- `validate()` remains authoritative for final legality checks even when discovery exists

Rationale:

- legal-input discovery is not the same problem as yes/no validation and generally cannot be inferred efficiently from validation logic alone
- many games need strong guidance for first-time players, bots, and agents
- some games have combinatorial or impractical full input spaces, so structured discovery is a better fit than exhaustive move enumeration

Discovery-ownership shape direction:

- discovery should be rooted primarily in per-command discovery hooks rather than a single central cross-command discovery service in v1

Implication:

- discovery should stay close to command semantics, much like `validate()` and `execute()`
- if a future higher-level "what can this actor do right now?" query is needed, it should be layered on top of per-command discovery rather than replacing it

Rationale:

- keeps discovery logic local to the command definitions that already own legality and execution meaning
- avoids turning a central discovery service into a second monolithic rules engine
- still leaves room to compose command-local discovery into broader actor-centric queries later

Discovery-shape detail direction:

- per-command discovery should be command-local and semantics-driven rather than forced into universal staged hook shapes

Implication:

- the kernel should not hardcode universal discovery stages such as `listCards` or `listTargets`
- each command or pending-choice response can define discovery in the shape that matches its own semantics
- multi-step interactions are the preferred way to break complex discovery into smaller command-specific or choice-specific steps

Rationale:

- not every command has the same discovery structure
- many complex flows are better modeled as explicit multi-step interactions than as one command with many hardcoded discovery stages
- this keeps discovery aligned with the earlier first-class pending-choice design

Discovery-optionality direction:

- per-command discovery hooks should be optional

Implication:

- commands that need no input guidance, such as `roll_dice`, `pass`, or `end_turn`, do not need discovery hooks
- `validate()` and `execute()` remain required, while `discover()` is only implemented when the command benefits from guided input or option surfacing

Rationale:

- avoids boilerplate for commands whose legal input space is trivial
- keeps discovery important without making it mandatory where it provides no value

Discovery-input direction:

- per-command discovery should receive both the read-only context and a partial command payload

Implication:

- discovery can answer follow-up questions such as "given this selected card, what targets are legal next?"
- discovery remains useful for both ordinary commands and multi-step interactions without forcing every flow to split into additional commands
- pending-choice state can still carry prior step context, but discovery should not be limited to context-only input

Rationale:

- many discovery questions depend on partially chosen inputs rather than only the raw game state
- keeps the API flexible enough for target selection, modal option narrowing, and similar progressive input flows

Discovery-output boundary direction:

- discovery output should stay semantic rather than UI-oriented

Implication:

- `discover()` should return the available next inputs or semantic options for the command in the given state
- presentation labels, UI grouping, and display wording should remain the responsibility of the consumer layer rather than the kernel
- if richer output is needed later, it should prefer lightweight semantic classification over UI-facing metadata

Rationale:

- preserves the transport-agnostic kernel boundary
- lets different hosts and interfaces present the same discovered options differently
- keeps discovery aligned with engine semantics rather than presentation concerns

Discovery-computation boundary direction:

- `discover()` should remain side-effect-free with respect to canonical engine state, but consumers may use arbitrarily complex computation inside it

Implication:

- discovery should not mutate canonical `game` or `runtime` state and should not commit engine effects
- consumers may still use expensive search, temporary analysis, local caching, or internal simulation inside discovery if they decide the performance tradeoff is worthwhile
- discovery performance remains primarily a game-author responsibility rather than a hard kernel-level restriction

Rationale:

- preserves the read-only nature of discovery at the engine boundary
- avoids over-constraining consumers who may need richer analysis for UI, bots, or agent guidance
- keeps the kernel focused on semantics while leaving performance strategy to the game implementation

Discovery-visibility direction:

- discovery results may legitimately vary by viewer or actor when hidden information matters

Implication:

- the same canonical state and command can yield different discovered options for different viewers
- discovery should run against a viewer-aware read-only context rather than assuming one globally identical answer
- the exact rules governing what each viewer may discover should be aligned later with the dedicated visibility and hidden-information model

Rationale:

- avoids leaking hidden information through discovery
- avoids making discovery too weak to be useful in games with private hands, decks, or role-specific knowledge
- acknowledges the boundary with the later visibility design topic without forcing that full model now

Internal-step posture:

- first-class public `InternalStep` should be deferred from the initial runtime unless implementation pressure proves it is the right abstraction

Implication:

- commands remain the only clearly committed first-class execution abstraction for now
- consumers can express most immediate automatic logic through helpers plus event emission
- richer engine-visible continuation work remains a likely future design space rather than a locked day-one abstraction

Rationale:

- helpers can already cover a large amount of reusable automatic logic in the initial direct-sequencing model
- step-specific semantics such as scheduling, event handling, and pending-choice behavior should be introduced only if inline helper logic becomes insufficient
- this avoids overcommitting to an abstraction before the first working implementation proves it necessary

Helper-effect abstraction direction:

- helpers or effects should remain consumer-owned implementation structure rather than a first-class kernel abstraction in v1

Implication:

- the kernel should not require a formal `Effect` or helper registration model yet
- consumers may structure reusable game logic as ordinary functions, objects, or other local abstractions
- helpers can be called from commands and from other consumer-authored rule logic, but they are not themselves first-class pipeline inputs

Rationale:

- avoids over-prescribing how consumers organize ordinary game logic
- keeps the kernel focused on execution semantics rather than consumer implementation style
- leaves room to promote effects or abilities into a richer kernel abstraction later if trigger or resolution design proves it necessary

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

2. command and event pipeline

Design-detail boundary:

- this topic is considered defined enough at a high level for now
- lower-level API and implementation details should be deferred until working code makes the tradeoffs easier to evaluate
