import {
  getStateMetadata,
  type FieldType,
  type StateClass,
  type StateFieldMetadata,
} from "./metadata";

export interface CompiledStateDefinition {
  type: StateClass;
  fields: Record<string, StateFieldMetadata>;
}

export interface CompiledStateFacadeDefinition {
  root: StateClass;
  states: Record<string, CompiledStateDefinition>;
}

export function compileStateFacadeDefinition(
  root: StateClass,
): CompiledStateFacadeDefinition {
  const states: Record<string, CompiledStateDefinition> = {};
  const visited = new Set<StateClass>();

  visitState(root, states, visited);

  return {
    root,
    states,
  };
}

function visitState(
  target: StateClass,
  states: Record<string, CompiledStateDefinition>,
  visited: Set<StateClass>,
): void {
  if (visited.has(target)) {
    return;
  }

  const metadata = getStateMetadata(target);
  visited.add(target);
  states[target.name] = {
    type: target,
    fields: {
      ...metadata.fields,
    },
  };

  for (const field of Object.values(metadata.fields)) {
    visitNestedStateTargets(field, states, visited);
  }
}

function visitNestedStateTargets(
  field: StateFieldMetadata,
  states: Record<string, CompiledStateDefinition>,
  visited: Set<StateClass>,
): void {
  if (field.kind === "state") {
    visitNestedStateTarget(field.target(), states, visited);
    return;
  }

  if (field.kind === "array") {
    visitNestedFieldTypeTargets(field.item, states, visited);
    return;
  }

  if (field.kind === "record") {
    visitNestedFieldTypeTargets(field.value, states, visited);
  }
}

function visitNestedFieldTypeTargets(
  field: FieldType,
  states: Record<string, CompiledStateDefinition>,
  visited: Set<StateClass>,
): void {
  if (field.kind === "state") {
    visitNestedStateTarget(field.target(), states, visited);
    return;
  }

  if (field.kind === "array") {
    visitNestedFieldTypeTargets(field.item, states, visited);
    return;
  }

  if (field.kind === "record") {
    visitNestedFieldTypeTargets(field.value, states, visited);
  }
}

function visitNestedStateTarget(
  nestedTarget: StateClass,
  states: Record<string, CompiledStateDefinition>,
  visited: Set<StateClass>,
): void {
  try {
    getStateMetadata(nestedTarget);
  } catch {
    throw new Error(
      `state_field_target_must_be_decorated:${nestedTarget.name || "anonymous"}`,
    );
  }

  visitState(nestedTarget, states, visited);
}
