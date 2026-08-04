import { describe, expect, it } from "vitest";
import { defineEvents } from "../src/events/registry.ts";
import { t } from "../src/schema/index.ts";

describe("defineEvents", () => {
  it("returns the registry unchanged for valid object schemas", () => {
    const schema = t.object({ actorId: t.string() });
    const registry = defineEvents({ card_bought: schema });
    expect(registry.card_bought).toBe(schema);
  });

  it("throws when a payload schema is not an object schema", () => {
    expect(() => defineEvents({ bad: t.string() as never })).toThrow(
      /event_payload_must_be_object_schema/,
    );
  });

  it("throws when a payload schema contains a non-serializable state field", () => {
    // A record whose value is a state field is not serializable.
    const objectWithState = {
      kind: "object" as const,
      properties: { nested: { kind: "state" as const } },
    };
    expect(() => defineEvents({ bad: objectWithState as never })).toThrow();
  });
});
