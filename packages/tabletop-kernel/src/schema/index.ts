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
  ArrayFieldType,
  BooleanFieldType,
  FieldType,
  InferSchema,
  NestedStateFieldType,
  NumberFieldType,
  ObjectFieldType,
  OptionalFieldType,
  PrimitiveFieldType,
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

  object(properties: Record<string, FieldType>): ObjectFieldType {
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
    ) as ObjectFieldType;
  },

  optional(item: FieldType): OptionalFieldType {
    return withSchema(
      {
        kind: "optional",
        item,
      },
      Type.Optional(toTypeBoxSchema(item)),
    ) as OptionalFieldType;
  },

  state(target: StateFieldTargetFactory): NestedStateFieldType {
    return {
      kind: "state",
      target,
    };
  },

  array(item: FieldType): ArrayFieldType {
    return withSchema(
      {
        kind: "array",
        item,
      },
      Type.Array(toTypeBoxSchema(item)),
    ) as ArrayFieldType;
  },

  record(key: PrimitiveFieldType, value: FieldType): RecordFieldType {
    return withSchema(
      {
        kind: "record",
        key,
        value,
      },
      Type.Record(toTypeBoxRecordKeySchema(key), toTypeBoxSchema(value)),
    ) as RecordFieldType;
  },
};

function toTypeBoxRecordKeySchema(key: PrimitiveFieldType): TSchema {
  if (key.kind === "string" && key.schema) {
    return key.schema;
  }

  return Type.String();
}
