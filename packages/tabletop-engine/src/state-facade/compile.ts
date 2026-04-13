import {
  type FieldVisibilityConfig,
  getStateMetadata,
  type StateClass,
} from "./metadata";
import type { FieldType, StateFieldMetadata } from "../schema";

export interface CompiledStateDefinition {
  type: StateClass;
  fields: Record<string, StateFieldMetadata>;
  fieldVisibility: Record<string, FieldVisibilityConfig>;
  ownedByField?: string;
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

  visitState(root, states, visited, false);

  return {
    root,
    states,
  };
}

function visitState(
  target: StateClass,
  states: Record<string, CompiledStateDefinition>,
  visited: Set<StateClass>,
  hasOwningPlayerAncestor: boolean,
): void {
  if (visited.has(target)) {
    return;
  }

  const metadata = getStateMetadata(target);
  validateVisibilityFields(target, metadata.fields, metadata.fieldVisibility);
  validateOwnedByField(target, metadata.fields, metadata.ownedByField);
  validateVisibleFieldOwnership(
    metadata.fieldVisibility,
    hasOwningPlayerAncestor || metadata.ownedByField !== undefined,
  );
  visited.add(target);
  states[target.name] = {
    type: target,
    fields: {
      ...metadata.fields,
    },
    fieldVisibility: {
      ...metadata.fieldVisibility,
    },
    ownedByField: metadata.ownedByField,
  };

  for (const field of Object.values(metadata.fields)) {
    visitNestedStateTargets(
      field,
      states,
      visited,
      hasOwningPlayerAncestor || metadata.ownedByField !== undefined,
    );
  }
}

function visitNestedStateTargets(
  field: StateFieldMetadata,
  states: Record<string, CompiledStateDefinition>,
  visited: Set<StateClass>,
  hasOwningPlayerAncestor: boolean,
): void {
  if (field.kind === "state") {
    visitNestedStateTarget(
      field.target(),
      states,
      visited,
      hasOwningPlayerAncestor,
    );
    return;
  }

  if (field.kind === "array") {
    visitNestedFieldTypeTargets(
      field.item,
      states,
      visited,
      hasOwningPlayerAncestor,
    );
    return;
  }

  if (field.kind === "record") {
    visitNestedFieldTypeTargets(
      field.value,
      states,
      visited,
      hasOwningPlayerAncestor,
    );
    return;
  }

  if (field.kind === "object") {
    for (const nestedField of Object.values(field.properties)) {
      visitNestedFieldTypeTargets(
        nestedField,
        states,
        visited,
        hasOwningPlayerAncestor,
      );
    }
    return;
  }

  if (field.kind === "optional") {
    visitNestedFieldTypeTargets(
      field.item,
      states,
      visited,
      hasOwningPlayerAncestor,
    );
  }
}

function visitNestedFieldTypeTargets(
  field: FieldType,
  states: Record<string, CompiledStateDefinition>,
  visited: Set<StateClass>,
  hasOwningPlayerAncestor: boolean,
): void {
  if (field.kind === "state") {
    visitNestedStateTarget(
      field.target(),
      states,
      visited,
      hasOwningPlayerAncestor,
    );
    return;
  }

  if (field.kind === "array") {
    visitNestedFieldTypeTargets(
      field.item,
      states,
      visited,
      hasOwningPlayerAncestor,
    );
    return;
  }

  if (field.kind === "record") {
    visitNestedFieldTypeTargets(
      field.value,
      states,
      visited,
      hasOwningPlayerAncestor,
    );
    return;
  }

  if (field.kind === "object") {
    for (const nestedField of Object.values(field.properties)) {
      visitNestedFieldTypeTargets(
        nestedField,
        states,
        visited,
        hasOwningPlayerAncestor,
      );
    }
    return;
  }

  if (field.kind === "optional") {
    visitNestedFieldTypeTargets(
      field.item,
      states,
      visited,
      hasOwningPlayerAncestor,
    );
  }
}

function visitNestedStateTarget(
  nestedTarget: StateClass,
  states: Record<string, CompiledStateDefinition>,
  visited: Set<StateClass>,
  hasOwningPlayerAncestor: boolean,
): void {
  try {
    getStateMetadata(nestedTarget);
  } catch {
    throw new Error(
      `state_field_target_must_be_decorated:${nestedTarget.name || "anonymous"}`,
    );
  }

  visitState(nestedTarget, states, visited, hasOwningPlayerAncestor);
}

function validateOwnedByField(
  target: StateClass,
  fields: Record<string, StateFieldMetadata>,
  ownedByField: string | undefined,
) {
  if (!ownedByField) {
    return;
  }

  if (!(ownedByField in fields)) {
    throw new Error(
      `owned_by_field_not_found:${target.name || "anonymous"}:${ownedByField}`,
    );
  }

  if (fields[ownedByField]?.kind !== "string") {
    throw new Error(
      `owned_by_field_requires_string_field:${target.name || "anonymous"}:${ownedByField}`,
    );
  }
}

function validateVisibilityFields(
  target: StateClass,
  fields: Record<string, StateFieldMetadata>,
  fieldVisibility: Record<string, FieldVisibilityConfig>,
) {
  for (const fieldName of Object.keys(fieldVisibility)) {
    if (!(fieldName in fields)) {
      throw new Error(
        `visibility_field_not_found:${target.name || "anonymous"}:${fieldName}`,
      );
    }
  }
}

function validateVisibleFieldOwnership(
  fieldVisibility: Record<string, FieldVisibilityConfig>,
  hasOwningPlayerAncestor: boolean,
) {
  for (const [fieldName, visibility] of Object.entries(fieldVisibility)) {
    if (visibility.mode === "visible_to_self" && !hasOwningPlayerAncestor) {
      throw new Error(
        `visible_to_self_requires_owned_player_ancestor:${fieldName}`,
      );
    }
  }
}
