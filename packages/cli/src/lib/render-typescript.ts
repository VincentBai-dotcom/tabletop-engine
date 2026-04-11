type JsonSchema = Record<string, unknown>;

export function renderTypeDeclaration(
  exportName: string,
  schema: JsonSchema,
): string {
  const body = renderSchemaType(schema, 0);

  if (body.startsWith("{")) {
    return `export interface ${exportName} ${body}\n`;
  }

  return `export type ${exportName} = ${body};\n`;
}

function renderSchemaType(schema: JsonSchema, indentLevel: number): string {
  if ("const" in schema) {
    return JSON.stringify(schema.const);
  }

  if ("anyOf" in schema && Array.isArray(schema.anyOf)) {
    return schema.anyOf
      .map((entry: unknown) =>
        renderSchemaType(entry as JsonSchema, indentLevel),
      )
      .join(" | ");
  }

  if ("type" in schema) {
    if (schema.type === "string") {
      return "string";
    }

    if (schema.type === "number" || schema.type === "integer") {
      return "number";
    }

    if (schema.type === "boolean") {
      return "boolean";
    }

    if (schema.type === "null") {
      return "null";
    }

    if (schema.type === "array") {
      return `(${renderSchemaType(schema.items as JsonSchema, indentLevel)})[]`;
    }

    if (schema.type === "object") {
      if ("patternProperties" in schema && schema.patternProperties) {
        const entries = Object.values(schema.patternProperties);
        const valueSchema = entries[0] as JsonSchema | undefined;
        const valueType = valueSchema
          ? renderSchemaType(valueSchema, indentLevel)
          : "unknown";

        return `Record<string, ${valueType}>`;
      }

      return renderObjectType(schema, indentLevel);
    }
  }

  return "unknown";
}

function renderObjectType(schema: JsonSchema, indentLevel: number): string {
  const properties =
    "properties" in schema && schema.properties ? schema.properties : {};
  const required = new Set(
    "required" in schema && Array.isArray(schema.required)
      ? schema.required
      : [],
  );
  const indent = "  ".repeat(indentLevel + 1);
  const closingIndent = "  ".repeat(indentLevel);
  const lines = Object.entries(properties).map(([key, value]) => {
    const optional = required.has(key) ? "" : "?";
    const propertyName = isIdentifier(key) ? key : JSON.stringify(key);

    return `${indent}${propertyName}${optional}: ${renderSchemaType(
      value as JsonSchema,
      indentLevel + 1,
    )};`;
  });

  if (lines.length === 0) {
    return "{}";
  }

  return `{\n${lines.join("\n")}\n${closingIndent}}`;
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(value);
}
