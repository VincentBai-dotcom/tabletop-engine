# Tabletop-Kernel Runtime Research Docs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a capability-first research document on the `boardgame.io` runtime and a root `AGENTS.md` that establishes the purpose and current status of `tabletop-kernel`.

**Architecture:** Treat `boardgame.io` as a reference implementation for pure game-runtime concerns only. Extract the runtime lessons into a Markdown research document organized by capabilities, then add a repository-level `AGENTS.md` that makes the project direction explicit without committing to client/server assumptions.

**Tech Stack:** Markdown, local TypeScript source inspection, `rg`

---

### Task 1: Capture source references

**Files:**
- Reference: `/home/vincent-bai/Documents/github/boardgame.io/src/core/flow.ts`
- Reference: `/home/vincent-bai/Documents/github/boardgame.io/src/core/reducer.ts`
- Reference: `/home/vincent-bai/Documents/github/boardgame.io/src/core/turn-order.ts`
- Reference: `/home/vincent-bai/Documents/github/boardgame.io/src/plugins/main.ts`
- Reference: `/home/vincent-bai/Documents/github/boardgame.io/src/plugins/events/events.ts`
- Reference: `/home/vincent-bai/Documents/github/boardgame.io/src/plugins/random/random.ts`

**Step 1: Confirm the key runtime entry points**

Run: `rg -n "export function Flow|export function CreateGameReducer|export function InitializeGame|export function SetActivePlayers|export class Events|export class Random" /home/vincent-bai/Documents/github/boardgame.io/src`
Expected: matches in `flow.ts`, `reducer.ts`, `initialize.ts`, `turn-order.ts`, `events.ts`, and `random.ts`

**Step 2: Record the line-number references for the writeup**

Run: `rg -n "ProcessGameConfig|FlushAndValidate|PlayerView|getFilterPlayerView|MockRandom" /home/vincent-bai/Documents/github/boardgame.io/src /home/vincent-bai/Documents/github/boardgame.io/src/testing`
Expected: concrete line references for the supporting runtime components

### Task 2: Write the capability-first research document

**Files:**
- Create: `docs/research/2026-03-12-boardgame-io-runtime-deep-dive.md`

**Step 1: Draft the architecture and lifecycle sections**

Cover reducer flow, plugins, move processing, events, and turn/phase progression.

**Step 2: Draft the determinism and secrecy sections**

Cover randomness, hidden information, serialization, replay, and undo/redo.

**Step 3: Draft the analysis sections**

For each capability, add `Keep`, `Avoid`, and `Needed Beyond boardgame.io`.

### Task 3: Write the repository guidance file

**Files:**
- Create: `AGENTS.md`

**Step 1: Define the project goal**

State that `tabletop-kernel` is a transport-agnostic board-game runtime intended to let coding agents build rules engines without rewriting core infrastructure.

**Step 2: Define current status and immediate priorities**

State that the repo is currently in the research/bootstrap stage and list the target runtime capabilities.

### Task 4: Verify the documentation artifacts

**Files:**
- Verify: `docs/research/2026-03-12-boardgame-io-runtime-deep-dive.md`
- Verify: `AGENTS.md`

**Step 1: Check the files exist and are readable**

Run: `sed -n '1,220p' docs/research/2026-03-12-boardgame-io-runtime-deep-dive.md`
Expected: the document opens with the runtime deep dive overview

**Step 2: Check the repo guidance file**

Run: `sed -n '1,220p' AGENTS.md`
Expected: the file states goal, non-goals, current status, and next priorities
