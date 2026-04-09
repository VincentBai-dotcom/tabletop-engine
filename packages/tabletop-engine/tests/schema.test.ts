import { expect, test } from "bun:test";
import { createCommandFactory } from "../src/command-factory";
import {
  field,
  getStateMetadata,
  hidden,
  OwnedByPlayer,
  State,
  t,
  viewSchema,
  visibleToSelf,
} from "../src/state-facade/metadata";
import { assertSerializableSchema } from "../src/schema";
import type { CommandSchema } from "../src/types/command";

type ExtendedSchemaApi = typeof t & {
  object: (properties: Record<string, unknown>) => unknown;
  optional: (item: unknown) => unknown;
  array: (item: unknown) => unknown;
  record: (key: unknown, value: unknown) => unknown;
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
  const commandSchema = (t as ExtendedSchemaApi).object({
    amount: (t as ExtendedSchemaApi).optional(t.number()),
  }) as {
    static: {
      amount?: number;
    };
  };

  const withAmount: typeof commandSchema.static = {
    amount: 2,
  };
  const withoutAmount: typeof commandSchema.static = {};

  expect(commandSchema).toBeDefined();
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

@State()
class NestedSerializableChildState {
  @field(t.number())
  count!: number;
}

test("serializable schema validation rejects nested state fields", () => {
  expect(() =>
    assertSerializableSchema(
      (t as ExtendedSchemaApi).object({
        child: t.state(() => NestedSerializableChildState),
      }) as never,
    ),
  ).toThrow("state_field_not_allowed_in_serializable_schema");
  expect(() =>
    assertSerializableSchema(
      (t as ExtendedSchemaApi).array(
        t.state(() => NestedSerializableChildState),
      ) as never,
    ),
  ).toThrow("state_field_not_allowed_in_serializable_schema");
  expect(() =>
    assertSerializableSchema(
      (t as ExtendedSchemaApi).optional(
        t.state(() => NestedSerializableChildState),
      ) as never,
    ),
  ).toThrow("state_field_not_allowed_in_serializable_schema");
  expect(() =>
    assertSerializableSchema(
      (t as ExtendedSchemaApi).record(
        t.string(),
        t.state(() => NestedSerializableChildState),
      ) as never,
    ),
  ).toThrow("state_field_not_allowed_in_serializable_schema");
});

test("command schemas reject nested state transport fields at definition time", () => {
  const defineCommand = createCommandFactory<object>();
  const invalidTransportSchema = (t as ExtendedSchemaApi).object({
    child: t.state(() => NestedSerializableChildState),
  }) as never as CommandSchema<{
    child: {
      count: number;
    };
  }>;

  expect(() =>
    defineCommand({
      commandId: "invalid_command",
      commandSchema: invalidTransportSchema,
    }),
  ).toThrow("state_field_not_allowed_in_serializable_schema");
});

test("discovery schemas reject nested state transport fields at definition time", () => {
  const defineCommand = createCommandFactory<object>();
  const invalidTransportSchema = (t as ExtendedSchemaApi).object({
    child: t.state(() => NestedSerializableChildState),
  }) as never as CommandSchema<{
    child: {
      count: number;
    };
  }>;

  expect(() =>
    defineCommand({
      commandId: "invalid_discovery_command",
      commandSchema: t.object({}),
    }).discoverable({
      discoverySchema: invalidTransportSchema,
      discover() {
        return null;
      },
    }),
  ).toThrow("state_field_not_allowed_in_serializable_schema");
});

test("hidden summary and custom view schemas reject nested state transport fields", () => {
  expect(() => {
    @State()
    class InvalidHiddenSummaryState {
      @hidden({
        schema: (t as ExtendedSchemaApi).object({
          child: t.state(() => NestedSerializableChildState),
        }) as never,
        project() {
          return {
            child: {
              count: 1,
            },
          };
        },
      })
      @field(t.array(t.number()))
      cards!: number[];
    }

    return InvalidHiddenSummaryState;
  }).toThrow("state_field_not_allowed_in_serializable_schema");

  expect(() => {
    @OwnedByPlayer()
    @State()
    class InvalidVisibleToSelfSummaryState {
      @field(t.string())
      id!: string;

      @visibleToSelf({
        schema: (t as ExtendedSchemaApi).object({
          child: t.state(() => NestedSerializableChildState),
        }) as never,
        project() {
          return {
            child: {
              count: 1,
            },
          };
        },
      })
      @field(t.array(t.number()))
      cards!: number[];
    }

    return InvalidVisibleToSelfSummaryState;
  }).toThrow("state_field_not_allowed_in_serializable_schema");

  expect(() => {
    @State()
    class InvalidCustomViewState {
      @field(t.number())
      count!: number;

      @viewSchema(
        (t as ExtendedSchemaApi).object({
          child: t.state(() => NestedSerializableChildState),
        }) as never,
      )
      projectCustomView() {
        return {
          child: {
            count: this.count,
          },
        };
      }
    }

    return InvalidCustomViewState;
  }).toThrow("state_field_not_allowed_in_serializable_schema");
});
