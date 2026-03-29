# Protocol Schema Migration Design

This document records the current design direction for adding the missing
runtime schema metadata that `tabletop-kernel` needs in order to generate a
protocol descriptor and, later, AsyncAPI.

The goal is to let the kernel generate the protocol description itself, without
making each consumer write custom spec-generation logic.

## Problem

`GameDefinition` already gives the kernel a lot of protocol-relevant metadata:

- command ids
- progression model
- viewer projection entrypoint through `getView(state, viewer)`
- state field runtime metadata through `@field(t...)`
- visibility semantics through `@hidden`, `@visibleToSelf`, and
  `@OwnedByPlayer()`

But it still does not fully describe:

- command payload schemas at runtime
- the returned shape of `projectCustomView(viewer)` for custom view nodes

Without those two pieces, the kernel cannot reliably generate a complete
protocol descriptor or AsyncAPI document.

## Goal

The kernel should own protocol-descriptor generation.

The consumer should provide only the missing runtime type metadata, colocated
with the game code that owns it.

The consumer should not write:

- a custom AsyncAPI generator
- a top-level command schema registry detached from command classes
- a top-level view schema registry detached from custom view methods

## Core Decisions

### One shared runtime type provider

Use a single runtime type provider: `t`.

Do not introduce a second schema builder like `s`.

Do not keep growing a bespoke runtime schema system if an existing library can
provide the foundation more reliably.

Reason:

- lower mental overhead
- one schema vocabulary across state fields, command payloads, and custom views
- easier to teach and remember
- easier future expansion to more types without inventing new kernel-specific
  schema semantics

The important distinction is not the provider name. The goal is to keep the
same schema vocabulary everywhere and make `t.state(...)` the only
state-authoring-specific form.

Examples:

- valid for state fields, command payloads, and custom views:
  - `t.number()`
  - `t.string()`
  - `t.boolean()`
  - `t.object(...)`
  - `t.array(...)`
  - `t.record(...)`
  - `t.optional(...)`
- valid only for state fields:
  - `t.state(() => PlayerState)`

`t.state(...)` should remain state-authoring-only and should not be allowed in
payload or custom-view schemas.

This means:

- `t.object(...)` should be allowed for state fields too
- `t.union(...)` should not be part of the first protocol-schema migration
- `t.literal(...)` should not be part of the first protocol-schema migration
- `t.nullable(...)` should not be part of the first protocol-schema migration
- `t.optional(...)` is the one absence helper in the first version

### Prefer an existing schema engine under `t`

The kernel-facing API should remain `t`, but the underlying schema
implementation should preferably be backed by an existing open-source solution
instead of expanding the current custom field-type DSL into a full schema
ecosystem.

Current recommendation:

- keep the kernel-facing `t` API
- use TypeBox underneath
- keep `t.state(...)` as the kernel-specific extension point

Why:

- protocol and AsyncAPI generation need stable schema semantics
- future type expansion becomes easier
- validation and schema export capabilities already exist in mature libraries
- the kernel can stay opinionated in its public API without owning the whole
  schema stack from scratch

This does not mean exposing the full underlying library surface immediately.
The first migration should still expose only the narrow `t` subset listed
above.

This also means the `t` types already supported today should be migrated to use
TypeBox under the hood, instead of continuing to evolve as a separate bespoke
schema representation.

### `t` should move out of `state-facade/metadata.ts`

`t` is no longer just a state-facade field helper.

Once it is also used for:

- state fields
- command payload schemas
- custom view schemas
- protocol generation

it deserves its own area under `packages/tabletop-kernel/src`.

Recommended direction:

- move the runtime type system into a dedicated schema folder or module under
  `src`
- keep `state-facade/metadata.ts` focused on decorators and state-authoring
  metadata

That separation will make the codebase easier to read and will reduce coupling
between:

- schema definition
- state-facade metadata
- visibility/protocol generation

### Command payload schema lives on the command class

Each command definition should provide a required runtime payload schema on the
command object itself.

Target shape:

```ts
const buyFaceUpCardPayload = t.object({
  level: t.number(),
  cardId: t.number(),
  chosenNobleId: t.optional(t.number()),
});

class BuyFaceUpCardCommand implements CommandDefinition<
  SplendorGameState,
  typeof buyFaceUpCardPayload
> {
  commandId = "buy_face_up_card";
  payloadSchema = buyFaceUpCardPayload;

  validate({ commandInput }) {
    commandInput.payload.cardId;
    return { ok: true as const };
  }

  execute({ commandInput }) {
    commandInput.payload.cardId;
  }
}
```

This is preferred over a top-level schema map because:

- the schema is owned by the command that consumes it
- command id, validation, execution, and payload schema stay colocated
- less risk of drift

### Custom view schema lives beside `projectCustomView(viewer)`

If a state uses `projectCustomView(viewer)`, the kernel cannot safely infer the
returned visible shape. The consumer should declare that shape next to the
method itself.

Target shape:

```ts
@State()
class DeckState {
  @hidden()
  @field(t.array(t.number()))
  cards!: number[];

  @viewSchema(
    t.object({
      count: t.number(),
    }),
  )
  projectCustomView(viewer: Viewer) {
    return {
      count: this.cards.length,
    };
  }
}
```

This is preferred over a top-level `viewSchemas({...})` map because:

- the schema is attached exactly where inference stops
- the custom visible shape and its schema stay together
- less detached bookkeeping

### Kernel should enforce completeness

The kernel should not silently generate partial protocol metadata.

When protocol generation is requested, the kernel should fail fast if required
metadata is missing.

Recommended boundary:

- ordinary game execution should not require protocol schemas
- protocol-descriptor generation should require them

So enforcement should happen in a protocol-generation API such as:

```ts
describeGameProtocol(gameDefinition);
```

## Command Payload Typing Ergonomics

The current consumer experience is too redundant if it requires:

- a payload TypeScript type
- a `CommandDefinition` generic using that type
- a separate runtime payload schema

The schema should become the source of truth.

Recommended direction:

- command generic parameter should reference the payload schema type
- `commandInput.payload` should be inferred from that schema

Target:

```ts
const reserveDeckCardPayload = t.object({
  level: t.number(),
});

class ReserveDeckCardCommand implements CommandDefinition<
  SplendorGameState,
  typeof reserveDeckCardPayload
> {
  commandId = "reserve_deck_card";
  payloadSchema = reserveDeckCardPayload;

  execute({ commandInput }) {
    commandInput.payload.level;
  }
}
```

That removes the need for a separate `ReserveDeckCardPayload` TypeScript type in
most cases.

## Enforcement Rules

### Command definitions

Each command should be required to provide:

- `commandId`
- `payloadSchema`

If `payloadSchema` is missing, the command definition should be considered
incomplete for protocol generation.

For commands with no payload, the command should still provide:

```ts
payloadSchema = t.object({});
```

This keeps the model uniform.

### Custom view methods

If a state defines `projectCustomView(viewer)`, the kernel should require an
explicit custom view schema for that method.

If the method exists but no schema is provided, protocol generation should fail.

If a schema is provided but the method does not exist, protocol generation
should also fail.

## Protocol Generation Direction

The desired consumer flow is:

```ts
const gameDefinition = new GameDefinitionBuilder(...)
  .commands([
    new BuyFaceUpCardCommand(),
    new ReserveDeckCardCommand(),
  ])
  .build();

const protocol = describeGameProtocol(gameDefinition);
```

No extra top-level schema maps should be necessary.

`describeGameProtocol(gameDefinition)` should:

- read command ids from command definitions
- read command payload schemas from each command
- infer visible state schema from state metadata by default
- detect `projectCustomView(viewer)` and use its declared schema
- fail if required metadata is missing

Later, an AsyncAPI generator can consume that protocol descriptor.

## Migration Plan

### Phase 1: Expand the runtime type provider

Add serializable schema constructs to `t`, such as:

- `t.number()`
- `t.string()`
- `t.boolean()`
- `t.object(...)`
- `t.array(...)`
- `t.record(...)`
- `t.optional(...)`

Retain the current state-field usage of `t`, and allow `t.object(...)` in state
fields as part of the same schema vocabulary.

### Phase 2: Command-local payload schemas

Update command authoring so every command provides `payloadSchema`.

Then migrate command typing so payload types are inferred from schema type,
reducing duplicated payload interfaces.

### Phase 3: Custom-view schema annotation

Add a method-level API such as `@viewSchema(...)` for `projectCustomView()`.

Keep automatic inference for ordinary metadata-driven projection.

### Phase 4: Protocol descriptor generation

Add `describeGameProtocol(gameDefinition)` that requires the schema metadata
above and produces a transport-agnostic protocol descriptor.

### Phase 5: AsyncAPI generation

Add a higher-level helper that converts the protocol descriptor into AsyncAPI.

The kernel or a tightly related package may own this generation, but the
consumer should still only provide colocated runtime metadata, not custom
generation logic.

## Open Questions

### Exact custom-view schema API shape

This design assumes a method-adjacent schema declaration such as
`@viewSchema(...)`, but the exact implementation form is still open.

### Where protocol generation should live

Likely options:

- inside `tabletop-kernel`
- in a tightly-coupled companion package

The key requirement is that the consumer should not need to author their own
generator logic.

### Runtime validation scope

This design is about runtime schema availability for protocol generation and
type inference. It does not yet decide whether the execution engine should also
use those schemas for runtime validation.
