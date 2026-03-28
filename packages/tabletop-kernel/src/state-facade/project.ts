import type { CompiledStateFacadeDefinition } from "./compile";
import type { FieldType, StateClass, VisibilityMode } from "./metadata";
import type { CanonicalState } from "../types/state";
import type { HiddenValue, Viewer, VisibleState } from "../types/visibility";

export function projectStateForViewer<TGameState extends object>(
  state: CanonicalState<TGameState>,
  viewer: Viewer,
  compiled?: CompiledStateFacadeDefinition,
): VisibleState<object> {
  if (!compiled) {
    return {
      game: structuredClone(state.game) as object,
      progression: structuredClone(state.runtime.progression),
    };
  }

  return {
    game: projectStateNode(compiled, compiled.root, state.game, viewer),
    progression: structuredClone(state.runtime.progression),
  };
}

function projectStateNode(
  compiled: CompiledStateFacadeDefinition,
  target: StateClass,
  backing: unknown,
  viewer: Viewer,
  ownerPlayerId?: string,
): object {
  if (!backing || typeof backing !== "object" || Array.isArray(backing)) {
    return {};
  }

  const definition = compiled.states[target.name];

  if (!definition) {
    throw new Error(`compiled_state_not_found:${target.name || "anonymous"}`);
  }

  const nextOwnerPlayerId = definition.ownedByPlayer
    ? readOwnerPlayerId(backing)
    : ownerPlayerId;
  const projected: Record<string, unknown> = {};

  for (const [fieldName, fieldType] of Object.entries(definition.fields)) {
    const visibility = definition.fieldVisibility[fieldName]?.mode;
    const fieldValue = (backing as Record<string, unknown>)[fieldName];

    if (visibility && shouldHideField(visibility, viewer, nextOwnerPlayerId)) {
      projected[fieldName] = createHiddenValue();
      continue;
    }

    projected[fieldName] = projectFieldValue(
      compiled,
      fieldType,
      fieldValue,
      viewer,
      nextOwnerPlayerId,
    );
  }

  return projected;
}

function projectFieldValue(
  compiled: CompiledStateFacadeDefinition,
  fieldType: FieldType,
  value: unknown,
  viewer: Viewer,
  ownerPlayerId?: string,
): unknown {
  if (
    value === null ||
    value === undefined ||
    fieldType.kind === "number" ||
    fieldType.kind === "string" ||
    fieldType.kind === "boolean"
  ) {
    return value;
  }

  if (fieldType.kind === "state") {
    return projectStateNode(
      compiled,
      fieldType.target(),
      value,
      viewer,
      ownerPlayerId,
    );
  }

  if (fieldType.kind === "array") {
    if (!Array.isArray(value)) {
      return value;
    }

    return value.map((item) =>
      projectFieldValue(compiled, fieldType.item, item, viewer, ownerPlayerId),
    );
  }

  if (fieldType.kind === "record") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        projectFieldValue(
          compiled,
          fieldType.value,
          entryValue,
          viewer,
          ownerPlayerId,
        ),
      ]),
    );
  }

  return value;
}

function shouldHideField(
  visibility: VisibilityMode,
  viewer: Viewer,
  ownerPlayerId?: string,
): boolean {
  if (visibility === "hidden") {
    return true;
  }

  return !(viewer.kind === "player" && viewer.playerId === ownerPlayerId);
}

function readOwnerPlayerId(backing: unknown): string | undefined {
  const ownerPlayerId =
    backing && typeof backing === "object"
      ? (backing as Record<string, unknown>).id
      : undefined;

  return typeof ownerPlayerId === "string" && ownerPlayerId.length > 0
    ? ownerPlayerId
    : undefined;
}

function createHiddenValue(): HiddenValue {
  return {
    __hidden: true,
  };
}
