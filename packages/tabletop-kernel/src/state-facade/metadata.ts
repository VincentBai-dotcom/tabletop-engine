export type StateClass<TState extends object = object> = new (
  ...args: unknown[]
) => TState;

import { t } from "../schema";
import type {
  FieldType,
  SerializableSchema,
  StateFieldMetadata,
} from "../schema";

export { t };

export type VisibilityMode = "hidden" | "visible_to_self";

export interface FieldVisibilityMetadata {
  mode: VisibilityMode;
}

export interface StateMetadata {
  type: "state";
  fields: Record<string, StateFieldMetadata>;
  fieldVisibility: Record<string, FieldVisibilityMetadata>;
  ownedByPlayer: boolean;
  customViewSchema?: SerializableSchema;
}

const STATE_METADATA = new WeakMap<StateClass, StateMetadata>();

function ensureStateMetadata(target: StateClass): StateMetadata {
  const existing = STATE_METADATA.get(target);

  if (existing) {
    return existing;
  }

  const created: StateMetadata = {
    type: "state",
    fields: {},
    fieldVisibility: {},
    ownedByPlayer: false,
    customViewSchema: undefined,
  };
  STATE_METADATA.set(target, created);
  return created;
}

function resolveDecoratorTarget(target: object): StateClass {
  return target.constructor as StateClass;
}

export function State(): ClassDecorator {
  return (target) => {
    ensureStateMetadata(target as unknown as StateClass);
  };
}

export function OwnedByPlayer(): ClassDecorator {
  return (target) => {
    const metadata = ensureStateMetadata(target as unknown as StateClass);
    metadata.ownedByPlayer = true;
  };
}

export function field(fieldType: FieldType): PropertyDecorator {
  return (target, propertyKey) => {
    const metadata = ensureStateMetadata(resolveDecoratorTarget(target));
    metadata.fields[String(propertyKey)] = fieldType;
  };
}

export function viewSchema(schema: SerializableSchema): MethodDecorator {
  return (target) => {
    const metadata = ensureStateMetadata(resolveDecoratorTarget(target));
    metadata.customViewSchema = schema;
  };
}

function setFieldVisibility(
  target: object,
  propertyKey: string | symbol,
  visibility: FieldVisibilityMetadata,
) {
  const metadata = ensureStateMetadata(resolveDecoratorTarget(target));
  metadata.fieldVisibility[String(propertyKey)] = visibility;
}

export function hidden(): PropertyDecorator {
  return (target, propertyKey) => {
    setFieldVisibility(target, propertyKey, {
      mode: "hidden",
    });
  };
}

export function visibleToSelf(): PropertyDecorator {
  return (target, propertyKey) => {
    setFieldVisibility(target, propertyKey, {
      mode: "visible_to_self",
    });
  };
}

export function getStateMetadata(target: StateClass): StateMetadata {
  const metadata = STATE_METADATA.get(target);

  if (!metadata) {
    throw new Error(`state_metadata_not_found:${target.name || "anonymous"}`);
  }

  return metadata;
}
