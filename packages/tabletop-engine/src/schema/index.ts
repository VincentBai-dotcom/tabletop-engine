import { Type, type TSchema } from "@sinclair/typebox";
import type {
  ArrayFieldType,
  BooleanFieldType,
  FieldType,
  NestedStateFieldType,
  NumberFieldType,
  ObjectFieldType,
  OptionalFieldType,
  PrimitiveFieldType,
  RecordFieldType,
  StateFieldTargetFactory,
  StringFieldType,
} from "./types";

export type {
  ArraySchemaStatic,
  ArrayFieldType,
  BooleanFieldType,
  FieldType,
  NestedStateFieldType,
  NumberFieldType,
  ObjectSchemaStatic,
  ObjectFieldType,
  OptionalSchemaStatic,
  OptionalFieldType,
  PrimitiveFieldType,
  RecordSchemaStatic,
  RecordFieldType,
  SerializableSchema,
  StateFieldMetadata,
  StateFieldTargetFactory,
  StringFieldType,
} from "./types";

function withSchema<TField extends object>(
  field: TField,
  schema: TSchema,
): TField {
  Object.defineProperty(field, "schema", {
    value: schema,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return field;
}

function toTypeBoxSchema(field: FieldType): TSchema {
  if ("schema" in field && field.schema) {
    return field.schema;
  }

  if (field.kind === "state") {
    return Type.Unknown();
  }

  return Type.Unknown();
}

export function assertSerializableSchema(
  schema:
    | FieldType
    | {
        kind: "object";
        properties: Record<string, FieldType>;
      },
): void {
  if (schema.kind === "state") {
    throw new Error("state_field_not_allowed_in_serializable_schema");
  }

  if (schema.kind === "array") {
    assertSerializableSchema(schema.item as FieldType);
    return;
  }

  if (schema.kind === "record") {
    assertSerializableSchema(schema.value as FieldType);
    return;
  }

  if (schema.kind === "object") {
    for (const nestedField of Object.values(schema.properties)) {
      assertSerializableSchema(nestedField as FieldType);
    }
    return;
  }

  if (schema.kind === "optional") {
    assertSerializableSchema(schema.item as FieldType);
  }
}

export const t = {
  number(): NumberFieldType {
    return withSchema(
      {
        kind: "number",
      },
      Type.Number(),
    ) as NumberFieldType;
  },

  string(): StringFieldType {
    return withSchema(
      {
        kind: "string",
      },
      Type.String(),
    ) as StringFieldType;
  },

  boolean(): BooleanFieldType {
    return withSchema(
      {
        kind: "boolean",
      },
      Type.Boolean(),
    ) as BooleanFieldType;
  },

  object<TProperties extends Record<string, FieldType>>(
    properties: TProperties,
  ): ObjectFieldType<TProperties> {
    return withSchema(
      {
        kind: "object",
        properties,
      },
      Type.Object(
        Object.fromEntries(
          Object.entries(properties).map(([key, value]) => [
            key,
            toTypeBoxSchema(value),
          ]),
        ),
      ),
    ) as ObjectFieldType<TProperties>;
  },

  optional<TItem extends FieldType>(item: TItem): OptionalFieldType<TItem> {
    return withSchema(
      {
        kind: "optional",
        item,
      },
      Type.Optional(toTypeBoxSchema(item)),
    ) as OptionalFieldType<TItem>;
  },

  state(target: StateFieldTargetFactory): NestedStateFieldType {
    return {
      kind: "state",
      target,
    };
  },

  array<TItem extends FieldType>(item: TItem): ArrayFieldType<TItem> {
    return withSchema(
      {
        kind: "array",
        item,
      },
      Type.Array(toTypeBoxSchema(item)),
    ) as ArrayFieldType<TItem>;
  },

  record<TKey extends PrimitiveFieldType, TValue extends FieldType>(
    key: TKey,
    value: TValue,
  ): RecordFieldType<TKey, TValue> {
    return withSchema(
      {
        kind: "record",
        key,
        value,
      },
      Type.Record(toTypeBoxRecordKeySchema(key), toTypeBoxSchema(value)),
    ) as RecordFieldType<TKey, TValue>;
  },
};

function toTypeBoxRecordKeySchema(key: PrimitiveFieldType): TSchema {
  if (key.kind === "string" && key.schema) {
    return key.schema;
  }

  return Type.String();
}
