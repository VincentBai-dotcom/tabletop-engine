import { Value } from "@sinclair/typebox/value";
import type { CanonicalState } from "../types/state";
import type { Snapshot } from "../types/snapshot";

export function createSnapshot<State extends CanonicalState>(
  state: State,
): Snapshot<State> {
  return {
    version: 1,
    state: Value.Clone(state),
  };
}

export function restoreSnapshot<State extends CanonicalState>(
  snapshot: Snapshot<State>,
): State {
  return Value.Clone(snapshot.state);
}
