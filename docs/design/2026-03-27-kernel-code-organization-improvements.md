# Kernel Code Organization Improvements

## Purpose

`tabletop-kernel` functionality is in a good state for the current milestone, but
the codebase still has a few readability and organization issues that will slow
future work if left alone.

This note records the main cleanup opportunities in
`packages/tabletop-kernel/src` so they can be revisited later.

The focus here is:

- code organization
- readability
- naming
- internal/public API clarity

This is not a behavior-change proposal.

## Current Observation

The kernel currently works, but some core files are carrying too much type
machinery and repeated wiring:

- `game-definition.ts`
- `kernel/create-kernel.ts`
- `types/command.ts`
- `types/progression.ts`

The main readability pressure comes from:

- repeated canonical-state vs facade-state generic plumbing
- repeated internal casts
- duplicated public/internal type shapes
- a few legacy naming exports that no longer match the intended consumer API

## Improvement Areas

### 1. Simplify `create-kernel.ts`

Current issue:

- `kernel/create-kernel.ts` repeats large generic casts many times
- the same `createCommandGameView(...)` wiring appears repeatedly
- the file is doing execution, hydration access, validation dispatch, and
  progression wiring all at once

Why it matters:

- hardest file to scan when debugging command execution
- type noise hides the actual runtime flow

Potential improvements:

- introduce one internal normalized game-definition type near the top of
  `createGameExecutor(...)`
- cast once instead of repeatedly
- extract small helpers like:
  - `createReadonlyGameView(state)`
  - `createMutableGameView(state)`
- rename the file to something more specific like `game-executor.ts`

### 2. Simplify `game-definition.ts`

Current issue:

- `GameDefinitionBuilder` uses several `as unknown as` transitions
- generic transitions between canonical state, facade state, and command maps are
  hard to read
- build-time concerns and type-transition concerns are mixed together

Why it matters:

- this is a central consumer-facing file
- the builder should read as stable and trustworthy

Potential improvements:

- split builder internals from public builder API
- extract command-list compilation into a dedicated helper file
- extract state-facade root compilation into a dedicated helper file
- consider simplifying the builder typing model even if it means relying more on
  build-time validation and less on fluent generic precision

### 3. Reduce Public/Internal Command Type Duplication

Current issue:

- `types/command.ts` contains both public and internal command context types
- public and internal versions are very similar, which makes the file feel
  doubled

Why it matters:

- the public API should be easy to read
- internal execution types should not clutter the consumer-facing layer

Potential improvements:

- keep public command types in `types/command.ts`
- move internal-only command context shapes closer to `kernel/`
- or derive both public/internal variants from smaller shared base types

### 4. Reduce Public/Internal Progression Type Duplication

Current issue:

- `types/progression.ts` mirrors the same duplication pattern as command types
- progression hooks, completion contexts, and internal variants all live in one
  place

Why it matters:

- progression is already conceptually dense
- duplicated type layers make the file harder to scan

Potential improvements:

- apply the same cleanup direction as command types
- separate public progression authoring types from internal execution-only types
- standardize naming around facade state where appropriate

### 5. Simplify State-Facade Compiler Traversal Naming

Current issue:

- `state-facade/compile.ts` uses several similarly named recursive helpers:
  - `visitState`
  - `visitNestedStateTargets`
  - `visitNestedFieldTypeTargets`
  - `visitNestedStateTarget`

Why it matters:

- the behavior is straightforward, but the naming makes it feel more complex than
  it is

Potential improvements:

- collapse the recursive traversal into fewer helpers
- use names that reflect reachability and traversal more clearly, for example:
  - `visitReachableStateClass`
  - `visitReachableFieldType`

### 6. Remove or Deprecate Legacy `Kernel` Naming

Current issue:

- `index.ts` still exports `createKernel` and `Kernel`
- that conflicts with the newer `GameExecutor` naming direction

Why it matters:

- keeps old terminology alive in the public surface
- makes the package feel less settled than it is

Potential improvements:

- remove the legacy aliases entirely
- or explicitly mark them as compatibility aliases scheduled for removal

### 7. Revisit Top-Level Folder Organization

Current issue:

- the current folder layout is workable, but a bit uneven
- `game-definition.ts` lives at the root
- execution internals live under `kernel/`
- public types live under `types/`
- state authoring lives under `state-facade/`

Why it matters:

- new contributors need a faster mental map of:
  - public definition-time API
  - executor/runtime internals
  - state authoring layer

Potential improvements:

- consider grouping by role, for example:
  - `definition/`
  - `executor/`
  - `state-authoring/`
  - `types/`
  - `replay/`
  - `snapshot/`

This does not need to happen immediately, but it is worth reconsidering before
more subsystems are added.

## Suggested Order

Recommended order of cleanup:

1. `kernel/create-kernel.ts`
2. `game-definition.ts`
3. `types/command.ts`
4. `types/progression.ts`
5. `state-facade/compile.ts`
6. legacy export cleanup in `index.ts`
7. broader folder reorganization

This order favors:

- highest readability gain first
- lowest behavior risk first
- minimal public API disruption early

## Recommended Scope Split

These changes should likely be split into two passes.

### Pass 1: Readability-Only Refactor

Goal:

- improve naming
- reduce repeated casts
- extract helpers
- keep file moves small
- preserve behavior and public API

Targets:

- `kernel/create-kernel.ts`
- `game-definition.ts`
- `types/command.ts`
- `types/progression.ts`
- `state-facade/compile.ts`

### Pass 2: Public Surface and Folder Cleanup

Goal:

- remove or deprecate legacy exports
- reorganize folders if still justified

Targets:

- `index.ts`
- file/folder layout under `src/`

## Non-Goal

This cleanup should not be mixed with:

- event queue work
- resolution stack work
- new runtime capabilities

Those should remain separate so the readability refactor stays reviewable.
