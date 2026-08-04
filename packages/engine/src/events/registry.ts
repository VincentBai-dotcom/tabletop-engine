import { assertSerializableSchema } from "../schema";
import type { FieldType, ObjectFieldType } from "../schema";
import type { GameEvent } from "../types/event";

/** A game's declared events: event `type` → payload object schema. */
export type EventRegistry = Record<
  string,
  ObjectFieldType<Record<string, FieldType>>
>;

/**
 * The registry of a game that declared no events. Keyed by `never` (not
 * `string`) so `keyof` is `never` — that is what lets `EmitEventCapability`
 * detect the "no declared events" case and contribute no `emitEvent` at all.
 */
export type EmptyEventRegistry = Record<never, never>;

/**
 * Declare a game's domain events once. Each entry's `t.object(...)` schema is
 * the payload contract — it types `emitEvent` (via the factory registry param)
 * and validates the payload at runtime. Returns the registry unchanged; capture
 * its type with `typeof`.
 */
export function defineEvents<const R extends EventRegistry>(registry: R): R {
  for (const [type, schema] of Object.entries(registry)) {
    if (schema.kind !== "object") {
      throw new Error(`event_payload_must_be_object_schema:${type}`);
    }
    assertSerializableSchema(schema);
  }
  return registry;
}

/** Full domain-event union (with `category`) — the shape the client observes. */
export type DomainEventsOf<R extends EventRegistry> = {
  [K in keyof R]: GameEvent<"domain", K & string, R[K]["static"]>;
}[keyof R];

/** Emit-side shape (no `category`; the engine stamps it). */
export type EmittableEventOf<R extends EventRegistry> = {
  [K in keyof R]: { type: K & string; payload: R[K]["static"] };
}[keyof R];
