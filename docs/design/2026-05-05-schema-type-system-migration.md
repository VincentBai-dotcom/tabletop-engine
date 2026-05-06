# Schema Type System Migration

## Problem

The current `tabletop-engine` schema API exposes field types that look like
TypeBox schema extensions at the TypeScript level, but the runtime values are
wrappers.

For example, `NumberFieldType` is declared as:

```ts
type NumberFieldType = TNumber & {
  kind: "number";
  readonly schema?: TNumber;
};
```

But `t.number()` currently creates an object shaped like:

```ts
{
  kind: "number",
  schema: Type.Number()
}
```

The field object is not itself a `TNumber`; it only contains a `TNumber` under
`.schema`. The casts in each `t` method hide that mismatch.

This is unsafe and makes the schema layer harder to reason about.

## Decision

Move to an extension model at runtime, with a separate engine-owned type
discriminant for static inference:

- Serializable fields are real TypeBox schemas.
- The engine attaches its own metadata directly to those schema objects.
- `t.state(...)` remains engine-only because nested state facade references are
  not TypeBox schemas.
- Static inference should use engine-owned metadata, not TypeBox's broad schema
  object shape.

The public lowercase authoring API can remain:

```ts
t.number()
t.string()
t.boolean()
t.object(...)
t.array(...)
t.record(...)
t.optional(...)
t.state(...)
```

This migration is about making runtime shape match the declared types, not about
renaming the API to Elysia-style `t.Number()` / `t.Object()`.

## Field Model

Serializable field values should extend TypeBox schema objects directly:

```ts
type NumberFieldType = TNumber & {
  readonly [fieldKind]: "number";
  kind: "number";
};

type ArrayFieldType<TItem> = TArray<ExtractSerializableSchema<TItem>> & {
  readonly [fieldKind]: "array";
  kind: "array";
  item: TItem;
};

type ObjectFieldType<TProperties> = TObject<...> & {
  readonly [fieldKind]: "object";
  kind: "object";
  properties: TProperties;
};
```

`t.state(...)` stays separate:

```ts
type StateFieldType = {
  readonly [fieldKind]: "state";
  kind: "state";
  target: StateFieldTargetFactory;
};
```

The full engine field union remains:

```ts
type FieldType = SerializableFieldType | StateFieldType;
```

`kind` is still useful at runtime. It is the engine's discriminant for facade
semantics, default canonical state generation, projection, hydration, and for
rejecting state fields in transport schemas. TypeBox's own schema shape is not
enough because TypeBox does not know about decorated state facade classes.

The private `fieldKind` symbol is for TypeScript-only discrimination. It avoids
using string properties such as `kind` and `item` in conditional types.

## Implementation Finding

An initial implementation attempt used only string metadata:

```ts
type NumberFieldType = TNumber & { kind: "number" };
type OptionalFieldType<TItem> = TOptional<...> & {
  kind: "optional";
  item: TItem;
};
```

That failed at the type level even though the runtime model was sound.

TypeBox's `TSchema` includes a broad string index signature through
`SchemaOptions`:

```ts
[prop: string]: any;
```

As a result, conditional types like this are not reliable:

```ts
TField extends { kind: "optional"; item: infer TItem } ? ... : ...
```

A plain TypeBox schema may appear to satisfy arbitrary string properties, which
caused incorrect inference such as required object fields becoming optional or
`undefined`. Combining TypeBox's recursive static types with the engine's
recursive field metadata also produced `Type instantiation is excessively deep
and possibly infinite` errors across the command factory, protocol, and test
types.

The corrected design keeps the runtime extension model, but static inference
must discriminate on an engine-owned `unique symbol` property and avoid
recursively deriving through full TypeBox intersections where a simpler
engine-owned static type is enough.

## Runtime Construction

Each serializable `t` method should assign engine metadata onto the TypeBox
schema object:

```ts
number(): NumberFieldType {
  return Object.assign(Type.Number(), {
    [fieldKind]: "number" as const,
    kind: "number" as const,
  });
}
```

Composite schemas should keep engine child metadata:

```ts
object<TProperties extends Record<string, FieldType>>(
  properties: TProperties,
): ObjectFieldType<TProperties> {
  return Object.assign(
    Type.Object(
      Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [
          key,
          toTypeBoxSchema(value),
        ]),
      ),
      { additionalProperties: false },
    ),
    {
      [fieldKind]: "object" as const,
      kind: "object" as const,
      properties,
    },
  );
}
```

The current hidden `.schema` property should be removed from serializable field
types and constructors. Serializable fields are already schemas.

## TypeBox Boundary

`toTypeBoxSchema(...)` should shrink. For serializable fields, it can return the
field directly. For state fields, it should either return `Type.Unknown()` where
the engine needs a placeholder or be avoided in APIs that require serializable
schemas.

Expected shape:

```ts
function toTypeBoxSchema(field: FieldType): TSchema {
  if (field.kind === "state") {
    return Type.Unknown();
  }

  return field;
}
```

Transport-facing APIs should still call `assertSerializableSchema(...)` so
command, discovery, setup input, and visibility schemas reject nested state
fields.

## Compatibility

The migration preserves the existing lowercase `t` API and should not require
consumer code changes for normal game authoring.

It does change runtime shape:

- `field.schema` should no longer be treated as the source of truth.
- `field` itself becomes the TypeBox schema.
- Code that depended on the hidden non-enumerable `.schema` property should
  migrate to using the field object directly.

This is acceptable because `.schema` was an implementation detail and was not a
coherent public API.

## Implementation Plan

1. Update `packages/tabletop-engine/src/schema/types.ts`.
   - Remove `readonly schema?: ...` from serializable field types.
   - Keep TypeBox intersections for serializable fields.
   - Add a private `unique symbol` field tag for type-level discrimination.
   - Keep `StateFieldType` / `NestedStateFieldType` as engine-only metadata.
   - Update static extraction helpers to discriminate by symbol metadata, not
     by string properties or TypeBox internals.

2. Rewrite `packages/tabletop-engine/src/schema/index.ts`.
   - Remove `withSchema(...)`.
   - Construct serializable fields with `Object.assign(Type.*(...), metadata)`.
   - Assign both runtime `kind` and symbol metadata.
   - Simplify `toTypeBoxSchema(...)`.
   - Update record key handling to use TypeBox schema objects directly.

3. Update tests.
   - Add assertions that `t.number()` / `t.object(...)` are valid TypeBox
     schemas directly.
   - Add assertions that engine metadata still exists on those schemas.
   - Add type-level coverage for optional object properties and command
     discovery schemas, because this is where the first implementation attempt
     regressed.
   - Keep existing rejection tests for nested `t.state(...)` in serializable
     transport schemas.

4. Run verification.
   - `bunx tsc -b --pretty false`
   - `bun test --cwd packages/tabletop-engine`
   - `bun test --cwd examples/splendor/engine`

## Non-Goals

- Do not rename the schema API to Elysia-style uppercase methods in this
  migration.
- Do not remove the engine `kind` discriminant.
- Do not make `t.state(...)` a TypeBox schema.
- Do not broaden the schema system into a general replacement for TypeBox.
