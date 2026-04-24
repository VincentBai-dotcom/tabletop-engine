# Callback-Scoped Step Discovery Authoring Design

## Purpose

Refine the explicit discovery-step API so it preserves strong contextual typing
without reintroducing the old `flow.step(...)` DSL.

This redesign is intentionally not backward compatible. The current
`discoverable(...builtSteps)` shape and the top-level `discoveryStep(...)`
helper should be removed rather than supported alongside the new model.

## Problem

The current explicit-step redesign fixed hidden control-flow behavior, but it
introduced a TypeScript ergonomics problem.

Example of the current shape:

```ts
defineCommand({
  commandId: "buy_face_up_card",
  commandSchema: buyFaceUpCardCommandSchema,
}).discoverable(
  discoveryStep("select_face_up_card")
    .initial()
    .input(selectFaceUpCardDiscoveryInputSchema)
    .output(selectFaceUpCardDiscoveryOutputSchema)
    .resolve(({ game }) => {
      game.getPlayer("player-1");
    })
    .build(),
);
```

The problem is that a top-level `discoveryStep(...)` helper does not naturally
carry the `FacadeGameState` type from the command factory into the
`resolve(...)` callback.

That means `resolve(({ game }) => ...)` tends to see:

```ts
game: object;
```

instead of the real game facade type:

```ts
game: SplendorGameState;
```

We worked around this by adding a command-factory-bound typed helper, but that
means consumers must author extra boilerplate such as:

```ts
export const defineSplendorDiscoveryStep = defineSplendorCommand.discoveryStep;
```

That is not the right consumer experience.

## Design Goals

- Keep discovery authoring explicit and step-based.
- Preserve per-option branching through `resolve(...)`.
- Keep `.initial()` explicit.
- Remove declaration-order fallback behavior entirely.
- Preserve strong contextual typing for `resolve(({ game }) => ...)`.
- Avoid requiring consumers to export a second typed discovery-step helper.
- Avoid returning to the old chained `flow.step(...).step(...)` DSL.

## Recommended Authoring Shape

`discoverable(...)` should accept a callback that receives a typed step builder
factory and returns an array of built steps:

```ts
defineCommand({
  commandId: "buy_face_up_card",
  commandSchema: buyFaceUpCardCommandSchema,
})
  .discoverable((step) => [
    step("select_face_up_card")
      .initial()
      .input(selectFaceUpCardDiscoveryInputSchema)
      .output(selectFaceUpCardDiscoveryOutputSchema)
      .resolve(({ actorId, game, discovery }) => {
        const draft = discovery.input;
        const player = game.getPlayer(actorId);

        if (draft.selectedLevel && draft.selectedCardId) {
          return {
            complete: true,
            input: {
              level: draft.selectedLevel,
              cardId: draft.selectedCardId,
            },
          };
        }

        return Object.entries(game.board.faceUpByLevel).flatMap(
          ([level, cardIds]) =>
            cardIds
              .filter((cardId) => {
                const card = game.getCard(cardId);
                return player.getAffordablePayment(card) !== null;
              })
              .map((cardId) => {
                const card = game.getCard(cardId);

                return {
                  id: `${level}:${cardId}`,
                  output: {
                    level: Number(level),
                    cardId,
                    bonusColor: card.bonusColor,
                    prestigePoints: card.prestigePoints,
                    source: "face_up",
                  },
                  nextStep: "select_face_up_card",
                  nextInput: {
                    ...draft,
                    selectedLevel: Number(level),
                    selectedCardId: cardId,
                  },
                };
              }),
        );
      })
      .build(),
  ])
  .validate(...)
  .execute(...)
  .build();
```

For multi-step discovery:

```ts
.discoverable((step) => [
  step("select_face_up_card")
    .initial()
    .input(selectFaceUpCardDiscoveryInputSchema)
    .output(selectFaceUpCardDiscoveryOutputSchema)
    .resolve(({ discovery }) => {
      return [
        {
          id: "1:42",
          output: { ... },
          nextStep: "select_return_token",
          nextInput: { ... },
        },
      ];
    })
    .build(),

  step("select_return_token")
    .input(selectReturnTokenDiscoveryInputSchema)
    .output(selectReturnTokenDiscoveryOutputSchema)
    .resolve(({ discovery }) => {
      return {
        complete: true,
        input: { ... },
      };
    })
    .build(),
])
```

## Why This Is Better

This shape keeps the good parts of explicit-step authoring:

- steps are explicit
- `.initial()` is explicit
- `nextStep` is explicit on each returned option
- completion is explicit

But it fixes the typing problem because the `step` factory is created inside
`discoverable(...)`, where TypeScript already knows the command builder's
`FacadeGameState`.

This means `resolve(({ game }) => ...)` keeps contextual typing without any
consumer-side helper export.

## Why Not Keep `discoverable(...steps)`?

The variadic `discoverable(...steps)` API is simpler on paper, but it pushes the
step builder outside the typed scope of the command builder.

That forces one of two bad outcomes:

- weak `resolve(...)` typing
- extra consumer boilerplate to create a typed helper from each command factory

The callback-scoped factory avoids both.

## Why This Is Still Better Than `flow.step(...)`

This callback is not the old DSL.

Old shape:

```ts
.discoverable((flow) =>
  flow
    .step("a", ...)
    .step("b", ...),
)
```

Problems with the old DSL:

- hidden chain state
- engine-shaped API
- encourages declaration-order semantics
- not plain data

New shape:

```ts
.discoverable((step) => [
  step("a").initial().input(...).output(...).resolve(...).build(),
  step("b").input(...).output(...).resolve(...).build(),
])
```

Properties of the new shape:

- callback exists only to scope typing
- steps are still plain explicit values
- the callback returns an ordinary array
- there is no flow-style chaining across steps
- there is no order-based transition fallback

So the callback is justified here because it provides type scope, not because
the engine wants a mini authoring DSL.

## Step Builder Semantics

Each step should still be authored through a staged builder:

```ts
step("select_face_up_card")
  .initial()
  .input(...)
  .output(...)
  .resolve(...)
  .build()
```

Required members:

- `.input(...)`
- `.output(...)`
- `.resolve(...)`
- `.build()`

Optional members:

- `.initial()`

The staged typing should still enforce:

- `.resolve(...)` unavailable before `.input(...).output(...)`
- `.build()` unavailable before `.resolve(...)`

## Initial Step Semantics

The starting step should remain explicit:

- exactly one step must be marked `.initial()`
- zero initial steps is an error
- more than one initial step is an error
- `discovery.startStep` is derived from that one initial step

Declaration order should not matter for choosing the start step.

## Step Resolution Semantics

Each step resolver remains:

```ts
resolve(context): StepOption[] | StepComplete | null
```

A non-complete option must have:

```ts
{
  id: string;
  output: StepOutput;
  nextStep: string;
  nextInput: NextStepInput;
}
```

`nextStep` stays required on every non-complete option.

The engine should not infer transitions from order.

A completion result remains:

```ts
{
  complete: true;
  input: CommandInput;
}
```

## Public API Surface

The public API should move from:

```ts
.discoverable(
  discoveryStep("a").initial().input(...).output(...).resolve(...).build(),
)
```

to:

```ts
.discoverable((step) => [
  step("a").initial().input(...).output(...).resolve(...).build(),
])
```

This means:

- remove top-level `discoveryStep(...)`
- remove command-factory-bound `discoveryStep` helper exports
- add a typed step factory parameter to `discoverable(...)`
- keep the built-step staged builder internally

## Protocol And SDK Implications

No transport-level change is required.

The protocol descriptor and generated SDK should continue to expose:

- explicit `startStep`
- per-step request typing
- per-command discovery request/result unions
- generated start helpers

The change is authoring-only and typing-oriented.

## Migration Direction

This should be treated as a breaking replacement.

Remove:

- `discoverable(...steps)`
- top-level `discoveryStep(...)`
- command-factory-bound `discoveryStep` helper usage

Adopt:

- `discoverable((step) => [ ... ])`

## Recommendation

Use the callback-scoped step factory:

- `discoverable((step) => [ ... ])`
- explicit `.initial()`
- explicit per-option `nextStep`
- no order-based fallback behavior
- no consumer-side typed step helper export

This is the best balance between explicit control-flow semantics and strong
consumer typing.
