import type { FieldType, ObjectFieldType } from "./types";

export type SerializedSetupField =
  | {
      kind: "number";
      min?: number;
      max?: number;
      enum?: number[];
      optional?: boolean;
    }
  | {
      kind: "string";
      min?: number;
      max?: number;
      enum?: string[];
      optional?: boolean;
    }
  | { kind: "boolean"; optional?: boolean }
  | {
      kind: "object";
      fields: Record<string, SerializedSetupField>;
      optional?: boolean;
    }
  | { kind: "array"; item: SerializedSetupField; optional?: boolean }
  | {
      kind: "record";
      value: SerializedSetupField;
      optional?: boolean;
    };

export interface SerializedSetupSchema {
  kind: "object";
  fields: Record<string, SerializedSetupField>;
}

export function serializeSetupSchema(
  schema: ObjectFieldType<Record<string, FieldType>> | undefined,
): SerializedSetupSchema | null {
  if (!schema) {
    return null;
  }

  return {
    kind: "object",
    fields: Object.fromEntries(
      Object.entries(schema.properties).map(([name, field]) => [
        name,
        serializeField(field),
      ]),
    ),
  };
}

function serializeField(field: FieldType): SerializedSetupField {
  if (field.kind === "optional") {
    return { ...serializeField(field.item), optional: true };
  }

  if (field.kind === "number") {
    const serialized: Extract<SerializedSetupField, { kind: "number" }> = {
      kind: "number",
    };
    if (field.minimum !== undefined) serialized.min = field.minimum;
    if (field.maximum !== undefined) serialized.max = field.maximum;
    const enumValues = numericEnum(field);
    if (enumValues) serialized.enum = enumValues;
    return serialized;
  }

  if (field.kind === "string") {
    const serialized: Extract<SerializedSetupField, { kind: "string" }> = {
      kind: "string",
    };
    if (field.minLength !== undefined) serialized.min = field.minLength;
    if (field.maxLength !== undefined) serialized.max = field.maxLength;
    const enumValues = stringEnum(field);
    if (enumValues) serialized.enum = enumValues;
    return serialized;
  }

  if (field.kind === "boolean") {
    return { kind: "boolean" };
  }

  if (field.kind === "object") {
    return {
      kind: "object",
      fields: Object.fromEntries(
        Object.entries(field.properties).map(([name, nestedField]) => [
          name,
          serializeField(nestedField),
        ]),
      ),
    };
  }

  if (field.kind === "array") {
    return { kind: "array", item: serializeField(field.item) };
  }

  if (field.kind === "record") {
    return { kind: "record", value: serializeField(field.value) };
  }

  throw new Error("state_field_not_allowed_in_setup_schema");
}

function numericEnum(field: object): number[] | undefined {
  const values = enumValues(field);
  return values?.every((value): value is number => typeof value === "number")
    ? values
    : undefined;
}

function stringEnum(field: object): string[] | undefined {
  const values = enumValues(field);
  return values?.every((value): value is string => typeof value === "string")
    ? values
    : undefined;
}

function enumValues(field: object): unknown[] | undefined {
  if (!("enum" in field) || !Array.isArray(field.enum)) {
    return undefined;
  }

  return field.enum;
}
