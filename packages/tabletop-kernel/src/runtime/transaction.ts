import type { CanonicalState } from "../types/state";

export function cloneCanonicalState<State extends CanonicalState>(
  state: State,
): State {
  return structuredClone(state);
}
