# Tabletop-Kernel Runtime Skeleton Design

**Date:** 2026-03-18

**Goal**

Create the first implementation boundary for `tabletop-kernel` as a Bun workspace with a real kernel package, while deferring the long-lived Splendor example until the user provides the rulebook and card data.

**Approved Scope**

- Convert the repo into a Bun workspace.
- Add a publishable kernel package at `packages/tabletop-kernel`.
- Reserve `examples/splendor` as the eventual end-to-end consumer package, but do not scaffold or implement it yet.
- Build only the minimum runtime skeleton needed to make the design concrete and testable.
- Stop before implementing real game rules or a real example game.

**Reference**

Per the official Bun docs, `bun init` is the intended scaffolding path for new projects, supports `-y` for defaults, and is non-destructive when run multiple times: <https://bun.com/docs/runtime/templating/init>.

**Approaches Considered**

### 1. Root package only

Keep the repo as a single package and place kernel source directly at the root.

**Pros**

- Lowest immediate setup cost
- Fewer files in the first commit

**Cons**

- Makes the future consumer/example boundary murky
- Harder to grow into multiple packages cleanly
- Less realistic for the intended long-lived example game

### 2. Bun workspace with kernel package and deferred example

Use a root Bun workspace now, create `packages/tabletop-kernel`, and defer `examples/splendor` until the real materials arrive.

**Pros**

- Matches the intended long-term repo shape
- Gives the kernel a clean publishable boundary immediately
- Avoids fake example code before real rules exist
- Keeps the next implementation steps focused on runtime semantics

**Cons**

- Slightly more setup than a single root package

### 3. Bun workspace with kernel package and placeholder example now

Create both the kernel package and a placeholder Splendor package immediately.

**Pros**

- Makes the consumer boundary visible right away

**Cons**

- Creates churn in the example package before real materials exist
- Risks cementing the wrong example-package shape too early

**Recommendation**

Use **Approach 2**.

It gives the repository the right long-term structure without forcing placeholder game code. The kernel package can be implemented and tested now, and the Splendor example can be added later as a real consumer instead of a temporary scaffold.

**First Runtime Skeleton**

The first implementation should provide:

- workspace setup and package scripts
- a kernel package entry point
- core runtime types for canonical state, command definitions, validation results, execution results, emitted events, progression state, RNG state, snapshots, and replay records
- a minimal `defineGame` / `createKernel` style API
- a command execution loop with:
  - validate
  - transactional working state
  - execute
  - event collection
  - atomic commit or unchanged-state failure
- deterministic RNG service skeleton with basic primitives only
- snapshot and replay interfaces
- a small scenario-style test harness skeleton

**Important Deferrals**

- first-class visibility / hidden-information subsystem
- first-class public `InternalStep` abstraction
- rich trigger resolution beyond the high-level contracts already documented
- richer resolution stack / queue support
- Splendor rules, cards, and end-to-end example package

**Package Layout**

Planned structure:

- `package.json`
- `bunfig.toml`
- `tsconfig.json`
- `packages/tabletop-kernel/package.json`
- `packages/tabletop-kernel/src/`
- `packages/tabletop-kernel/tests/`
- `examples/splendor/` later, not now

**Export Boundary**

The initial public exports should favor a small, stable surface:

- game-definition helpers
- runtime state types
- command-definition types
- event/result types
- progression types
- RNG types and APIs
- snapshot/replay interfaces
- test-harness entry points

Implementation details should stay internal until real usage proves which APIs deserve to stabilize.
