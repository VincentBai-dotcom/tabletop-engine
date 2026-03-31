# Command Payload Static Typing

## Goal

Consumer command code should define command payload shape once with the runtime
schema object and derive the payload TypeScript type from
`typeof payloadSchema.static`.

The target consumer experience is:

```ts
const reserveFaceUpCardPayloadSchema = t.object({
  level: t.optional(t.number()),
  cardId: t.optional(t.number()),
  returnTokens: t.optional(t.record(t.string(), t.number())),
});

export type ReserveFaceUpCardPayload =
  typeof reserveFaceUpCardPayloadSchema.static;

export class ReserveFaceUpCardCommand implements CommandDefinition<
  SplendorGameState,
  ReserveFaceUpCardPayload
> {
  readonly commandId = "reserve_face_up_card";
  readonly payloadSchema = reserveFaceUpCardPayloadSchema;
}
```

That replaces the current duplicate schema type alias pattern:

```ts
type ReserveFaceUpCardPayloadSchema = ObjectFieldType<...>;
```

## Decision

`CommandDefinition` should become payload-generic, not schema-generic.

That means:

- the second generic on `CommandDefinition` is the payload value type
- `commandInput.payload` in validate/execute/discovery contexts uses that payload
  type
- runtime schema and protocol generation still come from the `payloadSchema`
  property on the command instance

The schema object remains required. The generic changes from:

- schema metadata type

to:

- payload value type

## Why

The current schema-generic API forces consumers to define two type names:

- schema object type
- payload value type

Even with `schema.static`, the command class still has to mention the schema type
for `CommandDefinition` and context aliases. That defeats the main ergonomic
benefit.

Payload-generic command APIs let the consumer:

- define the runtime schema once
- derive one payload type from `schema.static`
- use that payload type everywhere in command code

## Required Engine Changes

### Command typing

`CommandDefinition`, `InternalCommandDefinition`, and the command context helper
types should use payload value types directly.

The payload schema property should be structurally constrained against the
payload type, so this remains valid:

```ts
payloadSchema: ObjectFieldTypeWithStatic<ReserveFaceUpCardPayload>;
```

The runtime still reads `payloadSchema` from the command object for:

- protocol descriptor generation
- AsyncAPI generation
- future runtime payload validation

### Shared schema typing

The schema API should expose the Elysia-style `.static` experience naturally.

Consumer code should prefer:

```ts
typeof payloadSchema.static;
```

and should not need:

- `InferSchema`
- handwritten payload interfaces
- handwritten schema alias types

## Splendor Migration Target

Each command file should end up with:

- one schema constant
- one exported payload type derived from `.static`
- no manual `ObjectFieldType<...>` payload schema alias

The Splendor commands will still use plain `string` / `number` for enum-like
payload fields for now, and explicitly validate them in `validate()` using:

- `invalid_color`
- `invalid_level`

## Non-Goals

This change does not add:

- `t.enum(...)`
- command runtime payload validation
- a factory-style command API

Those can be revisited later.
