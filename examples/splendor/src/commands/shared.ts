import type {
  Command,
  CommandAvailabilityContext,
  DiscoveryContext,
  ExecuteContext,
  ValidationContext,
  ValidationOutcome,
} from "tabletop-kernel";
import type { SplendorGameState } from "../state.ts";

interface ProgressionAwareState {
  runtime: {
    progression: {
      current: string | null;
      segments: Record<string, { ownerId?: string }>;
    };
  };
}

export type SplendorAvailabilityContext =
  CommandAvailabilityContext<SplendorGameState>;

export type SplendorDiscoveryContext = DiscoveryContext<SplendorGameState>;

export type SplendorValidationContext = ValidationContext<SplendorGameState>;

export type SplendorExecuteContext = ExecuteContext<SplendorGameState>;

export function readPayload<T>(commandInput: Command): T {
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

export function assertGameActive(game: SplendorGameState): void {
  if (game.winnerIds) {
    throw new Error("game_finished");
  }
}

export function assertActivePlayer(
  state: ProgressionAwareState,
  actorId: string | undefined,
): string {
  if (!actorId) {
    throw new Error("actor_id_required");
  }

  const currentSegmentId = state.runtime.progression.current;

  if (!currentSegmentId) {
    throw new Error("no_active_segment");
  }

  const currentOwnerId =
    state.runtime.progression.segments[currentSegmentId]?.ownerId;

  if (!currentOwnerId || actorId !== currentOwnerId) {
    throw new Error("not_active_player");
  }

  return actorId;
}

export function assertAvailableActor(
  context: CommandAvailabilityContext<SplendorGameState>,
): string {
  assertGameActive(context.state.game);
  return assertActivePlayer(context.state, context.actorId);
}
