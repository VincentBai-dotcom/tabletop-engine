import type { StageState } from "./progression";

/** The closed set of event categories: author-emitted vs engine-emitted. */
export type GameEventCategory = "domain" | "runtime";

export interface GameEvent<
  Category extends GameEventCategory = GameEventCategory,
  Type extends string = string,
  Payload = unknown,
> {
  category: Category;
  type: Type;
  payload: Payload;
}

/** Payload carried by the engine-owned stage lifecycle events. */
export interface StageLifecyclePayload {
  stageId: string;
  kind: StageState["kind"];
  activePlayerId: string | null;
  activePlayerIds: string[] | null;
}

/** Engine-owned events emitted around stage transitions. */
export type RuntimeEvent =
  | GameEvent<"runtime", "stage_entered", StageLifecyclePayload>
  | GameEvent<"runtime", "stage_exited", StageLifecyclePayload>;

/**
 * The engine's registry-agnostic runtime emit shape. The execution path
 * (`domainEmit`, the internal execute/run contexts) is one code path for all
 * games, so it types the emit boundary loosely here and enforces the real
 * contract dynamically via the registry. Authors never see this — they emit
 * through the typed `EmittableEventOf<Registry>` on their command/stage context.
 */
export interface EmittableEvent {
  type: string;
  payload: Record<string, unknown>;
}
