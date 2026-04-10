import { t, type FieldType, type ObjectFieldType } from "../schema";
import { getStateMetadata, type StateClass } from "./metadata";

export function compileCanonicalGameStateSchema(
  root: StateClass,
): ObjectFieldType<Record<string, FieldType>> {
  const metadata = getStateMetadata(root);

  return t.object(
    Object.fromEntries(
      Object.entries(metadata.fields).map(([fieldName, field]) => [
        fieldName,
        compileFieldSchema(field),
      ]),
    ),
  );
}

export function createDefaultCanonicalGameState(root: StateClass): object {
  return createCanonicalStateObject(root, new root());
}

function createCanonicalStateObject(
  target: StateClass,
  source: object,
): object {
  const metadata = getStateMetadata(target);
  const stateName = target.name || "anonymous";

  for (const fieldName of Object.keys(source)) {
    if (metadata.fields[fieldName] === undefined) {
      throw new Error(`undeclared_state_field_value:${stateName}.${fieldName}`);
    }
  }

  return Object.fromEntries(
    Object.entries(metadata.fields).map(([fieldName, field]) => [
      fieldName,
      createCanonicalFieldValue(
        field,
        (source as Record<string, unknown>)[fieldName],
        {
          stateName,
          fieldName,
        },
      ),
    ]),
  );
}

function compileFieldSchema(field: FieldType): FieldType {
  if (field.kind === "state") {
    return compileCanonicalGameStateSchema(field.target());
  }

  if (field.kind === "array") {
    return t.array(compileFieldSchema(field.item));
  }

  if (field.kind === "record") {
    return t.record(field.key, compileFieldSchema(field.value));
  }

  if (field.kind === "object") {
    return t.object(
      Object.fromEntries(
        Object.entries(field.properties).map(([key, value]) => [
          key,
          compileFieldSchema(value),
        ]),
      ),
    );
  }

  if (field.kind === "optional") {
    return t.optional(compileFieldSchema(field.item));
  }

  return field;
}

function createCanonicalFieldValue(
  field: FieldType,
  value: unknown,
  path: {
    stateName: string;
    fieldName: string;
  },
): unknown {
  if (field.kind === "state") {
    const source = value === undefined ? new (field.target())() : value;
    return createCanonicalStateObject(field.target(), source as object);
  }

  if (field.kind === "optional") {
    if (value === undefined) {
      return undefined;
    }

    return createCanonicalFieldValue(field.item, value, path);
  }

  if (value === undefined) {
    throw new Error(
      `missing_default_field_value:${path.stateName}.${path.fieldName}`,
    );
  }

  if (field.kind === "array") {
    if (!Array.isArray(value)) {
      return structuredClone(value);
    }

    return value.map((item) =>
      createCanonicalFieldValue(field.item, item, path),
    );
  }

  if (field.kind === "record") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        createCanonicalFieldValue(field.value, item, path),
      ]),
    );
  }

  if (field.kind === "object") {
    return Object.fromEntries(
      Object.entries(field.properties).map(([key, nestedField]) => [
        key,
        createCanonicalFieldValue(
          nestedField,
          (value as Record<string, unknown>)[key],
          {
            stateName: `${path.stateName}.${path.fieldName}`,
            fieldName: key,
          },
        ),
      ]),
    );
  }

  return structuredClone(value);
}
