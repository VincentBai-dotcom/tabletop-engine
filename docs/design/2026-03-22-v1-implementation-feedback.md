# V1 Implementation Feedback

This document records feedback on the current v1 implementation of the kernel
and the Splendor example.

This file is only for capturing the feedback first. It is not the response to
that feedback.

## Feedback

### 1. Turn progression logic feels too manual in consumer commands

The current Splendor implementation puts turn-ending logic in
`gameOps.finishTurn`, and each command calls `finishTurn()` because Splendor
allows one action per turn.

Related observation:

- `setCurrentSegmentOwner()` is also called from `finishTurn()`

Concern:

- logic that deals with turn progression should not need to be written into
  each consumer command
- if every command has to remember to call `finishTurn()`, the consumer can
  easily miss it

### 2. The consumer package feels too interface-heavy

Concern:

- the current kernel API feels more interface-heavy than expected for game
  authoring

Example expectation:

```ts
const splendorGame = new Game(...);
splendorGame.executeCommand(...);
```

Current feeling:

- the kernel exposes `defineGame(...)`
- that returns an object that fits the `GameDefinition` interface

Concern behind that feeling:

- for game code, consumers often think in terms of concrete game objects like
  cards, players, and the game itself
- the current API shape may feel more structural/interface-oriented than
  object-oriented
