# Facade-Only Consumer API Design

## Purpose

This document records the next consumer-facing API direction for
`tabletop-kernel` after the state-facade authoring work.

The goal is to make the public command and progression API expose only the
hydrated facade state, not the canonical plain state tree.

## Problem

The runtime now hydrates state facades correctly for:

- command execution
- command validation
- command discovery
- progression lifecycle hooks

But the public TypeScript API still mostly describes `game` as the canonical
plain state.

That creates a mismatch:

- runtime behavior gives consumers the facade
- public typings still suggest canonical state
- consumers need casts such as `getSplendorGameFacade(context.game)` to reach
  the actual authoring surface

This is the wrong end-state if the intended DSL is the facade itself.

## Locked Direction

The public consumer API should expose only the facade state.

That means:

- `CommandDefinition` should be parameterized by facade state, not canonical
  state
- `ValidationContext`, `DiscoveryContext`, `ExecuteContext`, and
  `CommandAvailabilityContext` should expose facade state only
- `ProgressionDefinition` and progression hook contexts should also expose
  facade state only

The canonical state tree should remain internal to the kernel.

## Consumer Experience

The target command authoring experience is:

```ts
class BuyFaceUpCardCommand implements CommandDefinition<
  SplendorGameStateFacade,
  BuyFaceUpCardInput
> {
  commandId = "buy_face_up_card";

  validate({ game, commandInput }) {
    const player = game.getPlayer(commandInput.actorId!);
    return { ok: true as const };
  }

  execute({ game, commandInput }) {
    const player = game.getPlayer(commandInput.actorId!);
    // mutate through facade methods
  }
}
```

And progression hooks should look like:

```ts
const progression: ProgressionDefinition<
  SplendorGameStateFacade,
  BuyFaceUpCardInput
> = {
  root: {
    id: "turn",
    children: [],
    onExit: ({ game, commandInput }) => {
      game.resolveTurnEnd(commandInput.actorId!);
    },
  },
};
```

There should be no consumer need to cast from canonical state to facade state
inside command or progression code.

## Canonical State Boundary

This does **not** mean the kernel stops using canonical plain state internally.

The kernel still owns:

- canonical `{ game, runtime }` state
- cloning the working copy
- hydration of the facade
- snapshots and replay
- persistence-facing canonical state

So the boundary becomes:

- **public API:** facade state only
- **internal kernel API:** canonical state plus facade hydration

## Enforcement

This direction intentionally reinforces the facade DSL:

- commands see only the facade
- progression hooks see only the facade
- direct facade field mutation is still rejected at runtime
- intended mutation path remains state methods on the facade

This does not provide perfect compile-time proof that all useful mutation goes
through methods, but it removes the canonical plain tree from normal consumer
authoring entirely.

## Internal Type Split

The type split should be:

- public:
  - `CommandDefinition<TFacadeState, TCommandInput>`
  - `ValidationContext<TFacadeState, TCommandInput>`
  - `DiscoveryContext<TFacadeState, TCommandInput>`
  - `ExecuteContext<TFacadeState, TCommandInput>`
  - `ProgressionDefinition<TFacadeState, TCommandInput>`

- internal:
  - `InternalCommandDefinition<TCanonicalState, TFacadeState, Runtime, TCommandInput>`
  - internal canonical-aware command contexts
  - internal canonical-aware progression contexts

So the current dual canonical/facade model remains inside the executor, but not
in the public authoring layer.

## Game Definition Direction

To make this work cleanly, the builder and game definition should carry both:

- the canonical game state shape
- the facade root state shape

But only the internal kernel types need to care about both.

The public authoring experience should still be:

```ts
new GameDefinitionBuilder<SplendorGameState>("splendor")
  .rootState(SplendorGameStateFacade)
  .commands(createCommands())
  .build();
```

with command and progression definitions typed against
`SplendorGameStateFacade`.

## Migration Direction

The migration should happen in small steps:

1. introduce internal canonical-plus-facade command/progression types
2. redefine public command contexts to facade-only types
3. redefine public progression contexts to facade-only types
4. thread the facade type through `GameDefinitionBuilder.rootState(...)`
5. migrate Splendor command and progression types to remove casts
6. remove temporary facade-cast helpers that become unnecessary
