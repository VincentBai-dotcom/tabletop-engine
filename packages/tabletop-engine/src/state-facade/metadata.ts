export type StateClass<TState extends object = object> = new (
  ...args: unknown[]
) => TState;

import { assertSerializableSchema, t } from "../schema";
import type {
  FieldType,
  SerializableSchema,
  StateFieldMetadata,
} from "../schema";

export { t };

export type VisibilityMode = "hidden" | "visible_to_self";

export interface HiddenFieldConfig {
  mode: "hidden";
  summary?: SerializableSchema;
  derive?: (value: unknown) => unknown;
}

export interface VisibleToSelfFieldConfig {
  mode: "visible_to_self";
  summary?: SerializableSchema;
  derive?: (value: unknown) => unknown;
}

export type FieldVisibilityConfig =
  | HiddenFieldConfig
  | VisibleToSelfFieldConfig;

export interface VisibilityConfigurationInput {
  ownedBy?: string;
  fields?: Record<string, FieldVisibilityConfig>;
}

export interface StateMetadata {
  type: "state";
  fields: Record<string, StateFieldMetadata>;
  fieldVisibility: Record<string, FieldVisibilityConfig>;
  ownedByField?: string;
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
    ownedByField: undefined,
  };
  STATE_METADATA.set(target, created);
  return created;
}

function resolveDecoratorTarget(target: object): StateClass {
  return target.constructor as StateClass;
}

function assertVisibilityFieldConfig<TConfig extends FieldVisibilityConfig>(
  config: TConfig,
): TConfig {
  if (config.summary) {
    assertSerializableSchema(config.summary);
  }

  return config;
}

export function State(): ClassDecorator {
  return (target) => {
    ensureStateMetadata(target as unknown as StateClass);
  };
}

export function field(fieldType: FieldType): PropertyDecorator {
  return (target, propertyKey) => {
    const metadata = ensureStateMetadata(resolveDecoratorTarget(target));
    metadata.fields[String(propertyKey)] = fieldType;
  };
}

export function hidden(
  options: {
    summary?: SerializableSchema;
    derive?: (value: unknown) => unknown;
  } = {},
): HiddenFieldConfig {
  return assertVisibilityFieldConfig({
    mode: "hidden",
    summary: options.summary,
    derive: options.derive,
  });
}

export function visibleToSelf(
  options: {
    summary?: SerializableSchema;
    derive?: (value: unknown) => unknown;
  } = {},
): VisibleToSelfFieldConfig {
  return assertVisibilityFieldConfig({
    mode: "visible_to_self",
    summary: options.summary,
    derive: options.derive,
  });
}

export function configureVisibility(
  target: StateClass,
  config: VisibilityConfigurationInput,
): void {
  const metadata = ensureStateMetadata(target);

  metadata.ownedByField = config.ownedBy;
  metadata.fieldVisibility = Object.fromEntries(
    Object.entries(config.fields ?? {}).map(([fieldName, fieldConfig]) => [
      fieldName,
      assertVisibilityFieldConfig(fieldConfig),
    ]),
  );
}

export function getStateMetadata(target: StateClass): StateMetadata {
  const metadata = STATE_METADATA.get(target);

  if (!metadata) {
    throw new Error(`state_metadata_not_found:${target.name || "anonymous"}`);
  }

  return metadata;
}
