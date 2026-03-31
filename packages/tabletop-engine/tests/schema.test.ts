import { expect, test } from "bun:test";
import {
  field,
  getStateMetadata,
  State,
  t,
} from "../src/state-facade/metadata";

type ExtendedSchemaApi = typeof t & {
  object: (properties: Record<string, unknown>) => unknown;
  optional: (item: unknown) => unknown;
};

@State()
class ObjectFieldState {
  @field(
    (t as ExtendedSchemaApi).object({
      count: t.number(),
      label: (t as ExtendedSchemaApi).optional(t.string()),
    }) as never,
  )
  summary!: {
    count: number;
    label?: string;
  };
}

test("schema api exposes shared object and optional builders", () => {
  const schemaApi = t as Partial<ExtendedSchemaApi>;

  expect(typeof schemaApi.object).toBe("function");
  expect(typeof schemaApi.optional).toBe("function");
});

test("schema static types can be derived directly from the schema object", () => {
  const payloadSchema = (t as ExtendedSchemaApi).object({
    amount: (t as ExtendedSchemaApi).optional(t.number()),
  }) as {
    static: {
      amount?: number;
    };
  };

  const withAmount: typeof payloadSchema.static = {
    amount: 2,
  };
  const withoutAmount: typeof payloadSchema.static = {};

  expect(payloadSchema).toBeDefined();
  expect(withAmount.amount).toBe(2);
  expect(withoutAmount.amount).toBeUndefined();
});

test("state metadata can consume object schemas through field decorators", () => {
  const metadata = getStateMetadata(ObjectFieldState);

  expect(metadata.fields.summary).toMatchObject({
    kind: "object",
    properties: {
      count: {
        kind: "number",
      },
      label: {
        kind: "optional",
        item: {
          kind: "string",
        },
      },
    },
  });
});
