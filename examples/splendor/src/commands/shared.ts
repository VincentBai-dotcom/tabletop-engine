import type {
  CommandAvailabilityContext,
  CommandInput,
  DiscoveryContext,
  ExecuteContext,
  ValidationContext,
  ValidationOutcome,
} from "tabletop-kernel";
import type { SplendorGameStateFacade } from "../state.ts";

type ProgressionRuntime = {
  progression: {
    current: string | null;
    segments: Record<string, { ownerId?: string }>;
  };
};

export type SplendorAvailabilityContext =
  CommandAvailabilityContext<SplendorGameStateFacade>;

export type SplendorDiscoveryContext =
  DiscoveryContext<SplendorGameStateFacade>;

export type SplendorValidationContext =
  ValidationContext<SplendorGameStateFacade>;

export type SplendorExecuteContext = ExecuteContext<SplendorGameStateFacade>;

export function readPayload<T>(commandInput: CommandInput): T {
  return (commandInput.payload ?? {}) as T;
}

export function guardedValidate(
  run: () => ValidationOutcome,
): ValidationOutcome {
  try {
    return run();
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "invalid_command",
    };
  }
}

export function guardedAvailability(run: () => boolean): boolean {
  try {
    return run();
  } catch {
    return false;
  }
}

export function assertGameActive(
  game: Readonly<SplendorGameStateFacade>,
): void {
  if (game.winnerIds) {
    throw new Error("game_finished");
  }
}

export function assertActivePlayer(
  runtime: ProgressionRuntime,
  actorId: string | undefined,
): string {
  if (!actorId) {
    throw new Error("actor_id_required");
  }

  const currentSegmentId = runtime.progression.current;

  if (!currentSegmentId) {
    throw new Error("no_active_segment");
  }

  const currentOwnerId =
    runtime.progression.segments[currentSegmentId]?.ownerId;

  if (!currentOwnerId || actorId !== currentOwnerId) {
    throw new Error("not_active_player");
  }

  return actorId;
}

export function assertAvailableActor(
  context: CommandAvailabilityContext<SplendorGameStateFacade>,
): string {
  assertGameActive(context.game);
  return assertActivePlayer(context.runtime, context.actorId);
}
