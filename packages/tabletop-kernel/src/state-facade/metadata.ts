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

export interface DataFieldType {
  kind: "data";
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
  | DataFieldType
  | NestedStateFieldType
  | ArrayFieldType
  | RecordFieldType;
export type StateFieldMetadata = FieldType;

export interface StateMetadata {
  type: "state";
  fields: Record<string, StateFieldMetadata>;
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

export function field(fieldType: FieldType): PropertyDecorator {
  return (target, propertyKey) => {
    const metadata = ensureStateMetadata(resolveDecoratorTarget(target));
    metadata.fields[String(propertyKey)] = fieldType;
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

  data<TData = unknown>(): DataFieldType {
    void (0 as unknown as TData);
    return {
      kind: "data",
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
