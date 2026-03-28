export type StateClass<TState extends object = object> = new (
  ...args: unknown[]
) => TState;

export type StateFieldTargetFactory = () => StateClass;

export interface NumberFieldType {
  kind: "number";
}

export interface StringFieldType {
  kind: "string";
}

export interface BooleanFieldType {
  kind: "boolean";
}

export interface NestedStateFieldType {
  kind: "state";
  target: StateFieldTargetFactory;
}

export interface ArrayFieldType {
  kind: "array";
  item: FieldType;
}

export interface RecordFieldType {
  kind: "record";
  key: PrimitiveFieldType;
  value: FieldType;
}

export type PrimitiveFieldType =
  | NumberFieldType
  | StringFieldType
  | BooleanFieldType;

export type FieldType =
  | PrimitiveFieldType
  | NestedStateFieldType
  | ArrayFieldType
  | RecordFieldType;
export type StateFieldMetadata = FieldType;

export type VisibilityMode = "hidden" | "visible_to_self";

export interface FieldVisibilityMetadata {
  mode: VisibilityMode;
}

export interface StateMetadata {
  type: "state";
  fields: Record<string, StateFieldMetadata>;
  fieldVisibility: Record<string, FieldVisibilityMetadata>;
  ownedByPlayer: boolean;
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

export const t = {
  number(): NumberFieldType {
    return {
      kind: "number",
    };
  },

  string(): StringFieldType {
    return {
      kind: "string",
    };
  },

  boolean(): BooleanFieldType {
    return {
      kind: "boolean",
    };
  },

  state(target: StateFieldTargetFactory): NestedStateFieldType {
    return {
      kind: "state",
      target,
    };
  },

  array(item: FieldType): ArrayFieldType {
    return {
      kind: "array",
      item,
    };
  },

  record(key: PrimitiveFieldType, value: FieldType): RecordFieldType {
    return {
      kind: "record",
      key,
      value,
    };
  },
};

export function getStateMetadata(target: StateClass): StateMetadata {
  const metadata = STATE_METADATA.get(target);

  if (!metadata) {
    throw new Error(`state_metadata_not_found:${target.name || "anonymous"}`);
  }

  return metadata;
}
