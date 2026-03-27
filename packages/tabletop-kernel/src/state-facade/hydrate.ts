import type {
  CompiledStateDefinition,
  CompiledStateFacadeDefinition,
} from "./compile";
import type { StateClass } from "./metadata";

export function hydrateStateFacade<TState extends object>(
  compiled: CompiledStateFacadeDefinition,
  backing: object,
  options?: {
    readonly?: boolean;
  },
): TState {
  const mutationContext: MutationContext = {
    readonlyMode: options?.readonly ?? false,
    mutationDepth: 0,
  };

  return hydrateStateInstance(
    compiled,
    compiled.root,
    backing,
    mutationContext,
  ) as TState;
}

function hydrateStateInstance(
  compiled: CompiledStateFacadeDefinition,
  target: StateClass,
  backing: object,
  mutationContext: MutationContext,
): object {
  const definition = getCompiledStateDefinition(compiled, target);
  const instance = new target();
  const nestedCache = new Map<string, object>();

  for (const [fieldName, field] of Object.entries(definition.fields)) {
    if (field.kind === "scalar") {
      Object.defineProperty(instance, fieldName, {
        enumerable: true,
        configurable: true,
        get() {
          return (backing as Record<string, unknown>)[fieldName];
        },
        set(value: unknown) {
          if (mutationContext.readonlyMode) {
            throw new Error(`readonly_state_facade_mutation:${fieldName}`);
          }
          if (mutationContext.mutationDepth === 0) {
            throw new Error(`direct_state_mutation_not_allowed:${fieldName}`);
          }

          (backing as Record<string, unknown>)[fieldName] = value;
        },
      });
      continue;
    }

    Object.defineProperty(instance, fieldName, {
      enumerable: true,
      configurable: true,
      get() {
        if (nestedCache.has(fieldName)) {
          return nestedCache.get(fieldName);
        }

        const nestedBacking = (backing as Record<string, unknown>)[fieldName];

        if (
          nestedBacking === null ||
          nestedBacking === undefined ||
          typeof nestedBacking !== "object"
        ) {
          return nestedBacking;
        }

        const nestedFacade = hydrateStateInstance(
          compiled,
          field.target(),
          nestedBacking,
          mutationContext,
        );
        nestedCache.set(fieldName, nestedFacade);
        return nestedFacade;
      },
      set(value: unknown) {
        if (mutationContext.readonlyMode) {
          throw new Error(`readonly_state_facade_mutation:${fieldName}`);
        }
        if (mutationContext.mutationDepth === 0) {
          throw new Error(`direct_state_mutation_not_allowed:${fieldName}`);
        }

        nestedCache.delete(fieldName);
        (backing as Record<string, unknown>)[fieldName] = value;
      },
    });
  }

  wrapStateMethods(instance, mutationContext);
  return instance;
}

function getCompiledStateDefinition(
  compiled: CompiledStateFacadeDefinition,
  target: StateClass,
): CompiledStateDefinition {
  const definition = compiled.states[target.name];

  if (!definition) {
    throw new Error(`compiled_state_not_found:${target.name || "anonymous"}`);
  }

  return definition;
}

interface MutationContext {
  readonlyMode: boolean;
  mutationDepth: number;
}

function wrapStateMethods(instance: object, mutationContext: MutationContext) {
  const prototype = Object.getPrototypeOf(instance);

  if (!prototype || prototype === Object.prototype) {
    return;
  }

  const descriptors = Object.getOwnPropertyDescriptors(prototype);

  for (const [methodName, descriptor] of Object.entries(descriptors)) {
    if (
      methodName === "constructor" ||
      typeof descriptor.value !== "function"
    ) {
      continue;
    }

    Object.defineProperty(instance, methodName, {
      enumerable: false,
      configurable: true,
      writable: false,
      value: (...args: unknown[]) => {
        mutationContext.mutationDepth += 1;

        try {
          return descriptor.value.apply(instance, args);
        } finally {
          mutationContext.mutationDepth -= 1;
        }
      },
    });
  }
}
