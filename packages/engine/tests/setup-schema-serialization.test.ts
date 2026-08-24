import { expect, test } from "vitest";
import { serializeSetupSchema, t } from "../src/index";

test("serializes a setup schema into JSON-safe field descriptors", () => {
  const schema = t.object({
    rounds: t.number({ min: 1, max: 12 }),
    mode: t.string({ enum: ["short", "long"] }),
    teams: t.optional(t.array(t.string())),
    advanced: t.boolean(),
  });

  const serialized = serializeSetupSchema(schema);
  const roundTripped = JSON.parse(JSON.stringify(serialized));

  expect(roundTripped).toEqual({
    kind: "object",
    fields: {
      rounds: { kind: "number", min: 1, max: 12 },
      mode: { kind: "string", enum: ["short", "long"] },
      teams: {
        kind: "array",
        item: { kind: "string" },
        optional: true,
      },
      advanced: { kind: "boolean" },
    },
  });
  expect(Object.getOwnPropertySymbols(roundTripped)).toEqual([]);
});

test("returns null when a game has no setup schema", () => {
  expect(serializeSetupSchema(undefined)).toBeNull();
});
