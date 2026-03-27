export type StateClass = abstract new (...args: unknown[]) => object;

export type StateFieldTargetFactory = () => StateClass;

export interface ScalarFieldMetadata {
  kind: "scalar";
}

export interface NestedStateFieldMetadata {
  kind: "state";
  target: StateFieldTargetFactory;
}

export type StateFieldMetadata = ScalarFieldMetadata | NestedStateFieldMetadata;

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

export function scalar(): PropertyDecorator {
  return (target, propertyKey) => {
    const metadata = ensureStateMetadata(resolveDecoratorTarget(target));
    metadata.fields[String(propertyKey)] = {
      kind: "scalar",
    };
  };
}

export function state(target: StateFieldTargetFactory): PropertyDecorator {
  return (decoratorTarget, propertyKey) => {
    const metadata = ensureStateMetadata(
      resolveDecoratorTarget(decoratorTarget),
    );
    metadata.fields[String(propertyKey)] = {
      kind: "state",
      target,
    };
  };
}

export function getStateMetadata(target: StateClass): StateMetadata {
  const metadata = STATE_METADATA.get(target);

  if (!metadata) {
    throw new Error(`state_metadata_not_found:${target.name || "anonymous"}`);
  }

  return metadata;
}
