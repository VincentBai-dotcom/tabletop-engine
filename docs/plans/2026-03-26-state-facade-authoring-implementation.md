# State Facade Authoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a decorator-driven state-facade authoring layer that compiles root state classes into metadata while preserving the current plain canonical state and `GameExecutor` execution model.

**Architecture:** The kernel will add a new definition-time pipeline for `@State()` classes and field decorators, compile reachable metadata from `rootState(...)`, and hydrate temporary facade objects over cloned plain game state during validation, discovery, and execution. The executor will continue returning plain canonical state, while commands and game code will author against root state facades and external immutable rule registries where needed.

**Tech Stack:** TypeScript, Bun, existing kernel test suite, decorator metadata implemented inside `packages/tabletop-kernel`

---

### Task 1: Add state metadata primitives

**Files:**

- Create: `packages/tabletop-kernel/src/state-facade/decorators.ts`
- Create: `packages/tabletop-kernel/src/state-facade/metadata.ts`
- Modify: `packages/tabletop-kernel/src/index.ts`
- Test: `packages/tabletop-kernel/tests/state-facade.test.ts`

**Step 1: Write the failing test**

Add a test that:

- defines `@State()` classes with `@scalar()` and `@state(() => ChildState)`
- asks the metadata layer for the compiled class metadata
- expects scalar and nested-state fields to be present

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/state-facade.test.ts`
Expected: FAIL because metadata primitives do not exist

**Step 3: Write minimal implementation**

Implement:

- `@State()`
- `@scalar()`
- `@state(() => NestedState)`
- metadata storage helpers for classes and fields

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/state-facade.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/state-facade/decorators.ts packages/tabletop-kernel/src/state-facade/metadata.ts packages/tabletop-kernel/src/index.ts packages/tabletop-kernel/tests/state-facade.test.ts
git commit -m "feat: add state facade metadata primitives"
```

### Task 2: Compile root state metadata from the builder

**Files:**

- Modify: `packages/tabletop-kernel/src/game-definition.ts`
- Create: `packages/tabletop-kernel/src/state-facade/compile.ts`
- Modify: `packages/tabletop-kernel/src/types/state.ts`
- Test: `packages/tabletop-kernel/tests/game-definition.test.ts`
- Test: `packages/tabletop-kernel/tests/state-facade.test.ts`

**Step 1: Write the failing test**

Add tests that:

- call `new GameDefinitionBuilder(...).rootState(GameState).build()`
- expect build to compile reachable state metadata from the explicit root
- expect build to fail when a nested `@state(...)` target is not decorated with `@State()`

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/game-definition.test.ts tests/state-facade.test.ts`
Expected: FAIL because `rootState(...)` and compilation do not exist

**Step 3: Write minimal implementation**

Implement:

- `rootState(...)` on `GameDefinitionBuilder`
- root-state metadata compilation reachable from the explicit root
- coherence validation for nested state targets
- storage of compiled facade metadata on the game definition

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/game-definition.test.ts tests/state-facade.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/game-definition.ts packages/tabletop-kernel/src/state-facade/compile.ts packages/tabletop-kernel/src/types/state.ts packages/tabletop-kernel/tests/game-definition.test.ts packages/tabletop-kernel/tests/state-facade.test.ts
git commit -m "feat: compile root state metadata"
```

### Task 3: Add facade hydration over canonical plain state

**Files:**

- Create: `packages/tabletop-kernel/src/state-facade/hydrate.ts`
- Modify: `packages/tabletop-kernel/src/kernel/create-kernel.ts`
- Modify: `packages/tabletop-kernel/src/types/command.ts`
- Test: `packages/tabletop-kernel/tests/kernel-execution.test.ts`
- Test: `packages/tabletop-kernel/tests/state-facade.test.ts`

**Step 1: Write the failing test**

Add a test that:

- defines decorated root/nested state classes with methods
- registers a command whose `execute()` calls a root/substate method
- expects canonical plain state to be updated correctly after execution

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/kernel-execution.test.ts tests/state-facade.test.ts`
Expected: FAIL because commands still receive plain game objects only

**Step 3: Write minimal implementation**

Implement:

- hydration of temporary facade objects over cloned plain game state
- method/property binding so state methods mutate the backing plain data
- executor wiring so `game` in command contexts becomes the hydrated root facade when root metadata is present

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/kernel-execution.test.ts tests/state-facade.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/state-facade/hydrate.ts packages/tabletop-kernel/src/kernel/create-kernel.ts packages/tabletop-kernel/src/types/command.ts packages/tabletop-kernel/tests/kernel-execution.test.ts packages/tabletop-kernel/tests/state-facade.test.ts
git commit -m "feat: hydrate state facades for command execution"
```

### Task 4: Make validation and discovery use readonly facades

**Files:**

- Modify: `packages/tabletop-kernel/src/kernel/create-kernel.ts`
- Modify: `packages/tabletop-kernel/src/state-facade/hydrate.ts`
- Modify: `packages/tabletop-kernel/src/types/command.ts`
- Test: `packages/tabletop-kernel/tests/kernel-execution.test.ts`

**Step 1: Write the failing test**

Add tests that:

- validate/discover against decorated state classes
- ensure facade methods are callable during validation/discovery
- ensure direct mutation is blocked or treated as readonly in those phases

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/kernel-execution.test.ts`
Expected: FAIL because only execute-time hydration exists

**Step 3: Write minimal implementation**

Implement readonly facade hydration mode for:

- `isAvailable`
- `discover`
- `validate`

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/kernel-execution.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/kernel/create-kernel.ts packages/tabletop-kernel/src/state-facade/hydrate.ts packages/tabletop-kernel/src/types/command.ts packages/tabletop-kernel/tests/kernel-execution.test.ts
git commit -m "feat: use readonly state facades for validation and discovery"
```

### Task 5: Add direct-mutation guardrails

**Files:**

- Modify: `packages/tabletop-kernel/src/state-facade/hydrate.ts`
- Test: `packages/tabletop-kernel/tests/state-facade.test.ts`

**Step 1: Write the failing test**

Add a test that:

- defines a command which directly assigns to a decorated field in `execute()`
- expects the facade layer to reject or guard this pattern according to the chosen rule

**Step 2: Run test to verify it fails**

Run: `bun test --cwd packages/tabletop-kernel tests/state-facade.test.ts`
Expected: FAIL because direct field mutation is still allowed

**Step 3: Write minimal implementation**

Implement the chosen guardrail for direct field mutation in command code.

**Step 4: Run test to verify it passes**

Run: `bun test --cwd packages/tabletop-kernel tests/state-facade.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/tabletop-kernel/src/state-facade/hydrate.ts packages/tabletop-kernel/tests/state-facade.test.ts
git commit -m "feat: guard direct state field mutation"
```

### Task 6: Port Splendor state to facade authoring

**Files:**

- Modify: `examples/splendor/src/state.ts`
- Modify: `examples/splendor/src/setup.ts`
- Modify: `examples/splendor/src/model/*.ts`
- Modify: `examples/splendor/src/game.ts`
- Modify: `examples/splendor/src/commands/*.ts`
- Test: `examples/splendor/tests/game.test.ts`
- Test: `examples/splendor/tests/data.test.ts`

**Step 1: Write the failing test**

Add or update a Splendor test to assert the example game uses `rootState(...)` with decorated state classes and still executes the same behavior.

**Step 2: Run test to verify it fails**

Run: `bun test --cwd examples/splendor`
Expected: FAIL because Splendor still uses plain interface state

**Step 3: Write minimal implementation**

Port Splendor to:

- decorated root/nested state classes
- state-local mutation methods where appropriate
- command code operating on hydrated root state facades

Keep external static data/definition registries outside match state.

**Step 4: Run test to verify it passes**

Run: `bun test --cwd examples/splendor`
Expected: PASS

**Step 5: Commit**

```bash
git add examples/splendor/src/state.ts examples/splendor/src/setup.ts examples/splendor/src/model examples/splendor/src/game.ts examples/splendor/src/commands examples/splendor/tests/game.test.ts examples/splendor/tests/data.test.ts
git commit -m "refactor: port splendor to state facade authoring"
```

### Task 7: Keep the terminal client working

**Files:**

- Modify: `examples/splendor-terminal/src/**/*.ts`
- Test: `examples/splendor-terminal/tests/*.test.ts`

**Step 1: Write the failing test**

Update or add a terminal-client test that exercises command building and session flow against the ported Splendor game.

**Step 2: Run test to verify it fails**

Run: `bun test --cwd examples/splendor-terminal`
Expected: FAIL if the Splendor public shape changed

**Step 3: Write minimal implementation**

Adjust the terminal example to the new Splendor state facade shape without changing its user-facing behavior.

**Step 4: Run test to verify it passes**

Run: `bun test --cwd examples/splendor-terminal`
Expected: PASS

**Step 5: Commit**

```bash
git add examples/splendor-terminal/src examples/splendor-terminal/tests
git commit -m "fix: keep splendor terminal client compatible"
```

### Task 8: Final verification and docs touch-up

**Files:**

- Modify: `packages/tabletop-kernel/README.md`
- Modify: `examples/splendor/README.md`
- Modify: `examples/splendor-terminal/README.md`

**Step 1: Update docs**

Document:

- `@State()` and field decorators
- `rootState(...)`
- facade hydration model
- command authoring expectations

**Step 2: Run full verification**

Run:

```bash
bun run lint
bunx tsc -b
bun test --cwd packages/tabletop-kernel
bun test --cwd examples/splendor
bun test --cwd examples/splendor-terminal
```

Expected: all pass

**Step 3: Commit**

```bash
git add packages/tabletop-kernel/README.md examples/splendor/README.md examples/splendor-terminal/README.md
git commit -m "docs: describe state facade authoring"
```
