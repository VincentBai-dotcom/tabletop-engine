# Progression Model Decisions

This is a living design document for the turn, phase, and progression topic.

Update this file whenever a progression-model design decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

### Generic progression concept

Turn, phase, step, round, and similar labels should be treated as named instances of one generic progression concept rather than as distinct built-in kernel concepts.

Current high-level direction:

- a progression segment is a bounded interval of game progression with an entry, an exit, and rules that apply while it is active
- labels such as turn, phase, step, and round mainly differ by naming, nesting, ownership, and transition rules
- the kernel should not hardcode fundamentally different semantics for those labels in the first version

Implication:

- consumers can model many different game structures without the kernel forcing one specific turn/phase taxonomy
- nesting like round -> turn -> phase -> step can be expressed as one family of progression segments rather than separate unrelated concepts

Rationale:

- many games use similar progression ideas with different names and structures
- a generic segment model is more flexible than hardcoded built-in turn/phase semantics

### Progression-definition style

Consumers should define progression as a declarative structure with hooks for lifecycle and transition behavior.

Current high-level direction:

- progression shape should be declared structurally rather than existing only as opaque callbacks
- hooks can still provide custom behavior for entering, exiting, or advancing progression segments

Implication:

- the engine gets an inspectable progression structure
- consumers still retain flexibility for game-specific lifecycle behavior

Rationale:

- a purely callback-based progression model would make structure too implicit
- a purely declarative model would be too rigid for many games

### Progression-to-command boundary

Progression should provide structured runtime context, while command legality and discovery remain in command definitions.

Current high-level direction:

- progression state belongs under kernel-owned runtime state rather than consumer-owned game state
- command `validate()` and `discover()` use progression context plus game state to determine legality and available options
- progression itself should not own the full command set

Implication:

- consumers do not discover legal commands by brute-forcing command payloads through `validate()`
- instead, command availability is surfaced through command-local discovery hooks that read current progression context
- if a broader "what can this actor do now?" query is needed later, it can be composed from command-local discovery rather than hardcoded into progression

Rationale:

- keeps progression responsible for progression semantics rather than command catalogs
- keeps command legality and discovery in the command layer where those decisions already belong

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

- how consumers should define turn, phase, and related progression concepts
- what those concepts mean in essence
- how consumers should express them in programming language
