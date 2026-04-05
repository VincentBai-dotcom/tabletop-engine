# Command Factory Migration Design

## Goal

Move consumer command authoring from class-based `implements CommandDefinition`
to a `defineCommand(...)` / `createCommandFactory(...)` API.

Note: the original one-shot object-literal factory described in this document
has since been refined into the chained builder model captured in
[`2026-04-05-chained-command-authoring-design.md`](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-05-chained-command-authoring-design.md).
That chained builder is the current accepted authoring direction.

The engine, not the consumer, should provide the method input types for:

- `isAvailable(context)`
- `discover(context)`
- `validate(context)`
- `execute(context)`

## Problem

Current command authoring makes consumers define too much type plumbing.

In Splendor today, the consumer has to:

- define local context aliases in
  [`examples/splendor/src/commands/shared.ts`](/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/src/commands/shared.ts)
- manually annotate the parameter type of `isAvailable`, `discover`,
  `validate`, and `execute`
- repeat the game-state type in each command class generic

This happens because `class ... implements CommandDefinition<...>` only checks
compatibility after the class is written. It does not contextually type class
method parameters from the interface.

## Recommended Direction

Adopt a game-bound command factory as the primary authoring API.

This migration is intentionally one-way:

- class-based command authoring will be removed from the public API
- backward compatibility in command authoring types is not a goal
- legacy command-authoring code should be deleted rather than preserved

Recommended shape:

```ts
const defineSplendorCommand = createCommandFactory<SplendorGameState>();

export const takeThreeDistinctGemsCommand = defineSplendorCommand({
  commandId: "take_three_distinct_gems",
  commandSchema: t.object({
    colors: t.optional(t.array(t.string())),
    returnTokens: t.optional(t.record(t.string(), t.number())),
  }),
})
  .discoverable({
    discoverySchema: t.object({
      selectedColors: t.optional(t.array(t.string())),
      returnTokens: t.optional(t.record(t.string(), t.number())),
    }),
    discover({ discovery }) {
      return {
        complete: true,
        input: {
          colors: discovery.input?.selectedColors ?? [],
        },
      };
    },
  })
  .isAvailable(({ game, actorId, runtime }) => {
    void game;
    void actorId;
    void runtime;
    return true;
  })
  .validate(({ game, runtime, command }) => {
    void game;
    void runtime;
    void command;
    return { ok: true };
  })
  .execute(({ game, command, emitEvent }) => {
    void game;
    void command;
    void emitEvent;
  })
  .build();
```

In that model:

- `SplendorGameState` is bound once in the factory
- command input is inferred from `commandSchema`
- discovery input is inferred from `discoverySchema`
- method parameter types are supplied by the engine
- consumers no longer need local context aliases

## Why `defineCommand(...)` Instead Of A Base Class

An abstract base class would improve the current class API, but it would still
be weaker than a factory:

- it can reduce explicit method parameter annotations
- but it still requires class generics
- and it still cannot infer `TPayload` / `TDraft` from sibling schema
  properties in the same way an object-literal factory can

The factory approach is the closest match to the desired Elysia-style
experience.

## Proposed API Shape

### Public Factory

Add:

```ts
createCommandFactory<FacadeGameState>();
```

It returns:

```ts
defineCommand({ commandId, commandSchema });
```

### Discoverable vs Non-Discoverable Commands

Discovery should be added only through:

- `.discoverable({ discoverySchema, discover })`

Non-discoverable commands are the default and require no special step.

This preserves the protocol guarantees already enforced in
[`packages/tabletop-engine/src/protocol/describe.ts`](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/protocol/describe.ts),
while giving the authoring flow an explicit discovery step instead of one large
object literal.

### Return Shape

The final built command should still return the same structural command object
shape the engine already uses today:

- `commandId`
- `commandSchema`
- optional `discoverySchema`
- optional `isAvailable`
- optional `discover`
- required `validate`
- required `execute`

This keeps the migration mostly at the authoring and typing layer, even though
the consumer writes the definition through a staged builder and ends with
`.build()`.

### Legacy Removal Policy

This migration should remove the old command-authoring path completely.

That means:

- no class-based command authoring as a supported public API
- no type-layer compatibility effort for `class ... implements CommandDefinition`
- no docs/examples showing command classes
- no legacy helper types kept only to support the old command authoring style

State authoring remains class-based. This decision applies to commands only.

## Dependency Surface Investigation

### 1. GameDefinitionBuilder

File:

- [`packages/tabletop-engine/src/game-definition.ts`](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/game-definition.ts)

Current behavior:

- accepts a command map or a command list
- normalizes list input into a command map by `commandId`

Conclusion:

- this area does not require a structural redesign
- the builder already depends on command object shape, not command classes
- only typing cleanup may be needed

### 2. GameExecutor Runtime

File:

- [`packages/tabletop-engine/src/runtime/game-executor.ts`](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/runtime/game-executor.ts)

Current behavior:

- reads command objects from `game.commands`
- calls `isAvailable`, `discover`, `validate`, and `execute`
- hydrates facade state on demand before each command lifecycle call

Conclusion:

- no migration issue here, as long as `defineCommand(...)` returns the same
  object contract
- facade hydration should continue to work unchanged

### 3. Protocol Descriptor

File:

- [`packages/tabletop-engine/src/protocol/describe.ts`](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/protocol/describe.ts)

Current behavior:

- reads `payloadSchema`
- reads `discoveryDraftSchema`
- validates discoverability pairing

Conclusion:

- no class dependency
- should continue to work if the returned command object has the same fields

### 4. AsyncAPI Generator

File:

- [`packages/tabletop-engine/src/protocol/asyncapi.ts`](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/protocol/asyncapi.ts)

Current behavior:

- builds submit-command schemas from `payloadSchema`
- builds discovery input/result/rejection schemas from
  `discoveryDraftSchema` and `payloadSchema`

Conclusion:

- no class dependency
- should continue to work unchanged if command objects retain the same
  properties

### 5. Example Games

Files:

- [`examples/splendor/src/commands`](/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/src/commands)

Current behavior:

- every command is a class
- local context aliases exist only to work around the class typing problem

Required changes:

- replace classes with `defineSplendorCommand(...)`
- remove most or all of the command-context aliases from
  [`examples/splendor/src/commands/shared.ts`](/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/src/commands/shared.ts)
- keep helper functions like `assertAvailableActor`, `readPayload`, and
  `readDraft`

### 6. Tests

Files:

- [`packages/tabletop-engine/tests`](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/tests)
- [`examples/splendor/tests`](/home/vincent-bai/Documents/github/tabletop-kernel/examples/splendor/tests)

Required changes:

- command fixtures in tests should move from classes to factory-defined command
  objects where they are testing normal consumer authoring
- internal engine typing tests should be updated to validate the new factory
  inference behavior explicitly

### 7. Exports and Public API Surface

File:

- [`packages/tabletop-engine/src/index.ts`](/home/vincent-bai/Documents/github/tabletop-kernel/packages/tabletop-engine/src/index.ts)

Required changes:

- export `createCommandFactory`
- likely keep `CommandDefinition` as the structural type the factory returns

Decision:

- class-oriented command authoring should not remain supported

## What Probably Does Not Need To Change

These areas appear structurally compatible with the migration:

- command storage in `GameDefinition`
- command execution in `GameExecutor`
- facade hydration during availability/discovery/validation/execution
- protocol descriptor extraction
- AsyncAPI generation

The main migration is at the authoring API and type inference boundary, not the
execution pipeline.

## Awkward Or Risky Areas

### 1. Game-Bound Factory Requirement

The best DX comes from:

```ts
const defineSplendorCommand = createCommandFactory<SplendorGameState>();
```

This means the consumer still binds the game state once per game package.

That is acceptable, but it is still one explicit step. There is no realistic
way to remove even that while keeping the command definitions decoupled from the
builder.

## Migration Recommendation

Recommended sequence:

1. add `createCommandFactory<FacadeGameState>()`
2. keep `CommandDefinition` as the structural return type
3. add type tests proving contextual inference for all four methods
4. migrate Splendor commands first
5. remove local Splendor command-context aliases
6. update docs/examples to present factory-based authoring as the default
7. remove legacy class-based command authoring code completely

## Summary

The key finding is:

- the executor, builder, protocol descriptor, and AsyncAPI generator already
  depend on command shape, not command class identity

That means the migration is viable and mostly localized.

The main work is:

- introduce a game-bound command factory
- migrate examples/tests
- simplify the public authoring story

The main thing to avoid is trying to preserve class-based authoring as an equal
first-class experience, because that keeps the exact DX problem this migration
is meant to solve.
