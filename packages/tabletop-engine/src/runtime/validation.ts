import { Value } from "@sinclair/typebox/value";
import type { TSchema } from "@sinclair/typebox";
import type { FieldType } from "../schema";

type SchemaWithTypeBox = FieldType | TSchema | ({ schema?: TSchema } & object);

function getTypeBoxSchema(schema: SchemaWithTypeBox): TSchema {
  if ("schema" in schema && schema.schema) {
    return schema.schema;
  }

  return schema as TSchema;
}

export function assertSchemaValue(
  schema: SchemaWithTypeBox,
  value: unknown,
): void {
  const typeBoxSchema = getTypeBoxSchema(schema);

  if (Value.Check(typeBoxSchema, value)) {
    return;
  }

  const firstError = Value.Errors(typeBoxSchema, value).First();
  const errorPath = firstError?.path || "/";
  throw new Error(`invalid_schema_value:${errorPath}`);
}
