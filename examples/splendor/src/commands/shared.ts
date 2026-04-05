import type {
  CommandAvailabilityContext,
  DefinedCommand,
  ValidationOutcome,
} from "tabletop-engine";
import { createCommandFactory } from "tabletop-engine";
import {
  DEVELOPMENT_LEVELS,
  GEM_TOKEN_COLORS,
  type DevelopmentLevel,
  type GemTokenColor,
  type SplendorGameState,
} from "../state.ts";

type ProgressionRuntime = {
  progression: {
    current: string | null;
    segments: Record<string, { ownerId?: string }>;
  };
};

export const defineSplendorCommand = createCommandFactory<SplendorGameState>();

export type SplendorCommand = DefinedCommand<SplendorGameState>;

export function isGemTokenColor(value: unknown): value is GemTokenColor {
  return (
    typeof value === "string" &&
    (GEM_TOKEN_COLORS as readonly string[]).includes(value)
  );
}

export function isDevelopmentLevel(value: unknown): value is DevelopmentLevel {
  return (
    typeof value === "number" &&
    (DEVELOPMENT_LEVELS as readonly number[]).includes(value)
  );
}

export function assertGemTokenColor(value: unknown): GemTokenColor {
  if (!isGemTokenColor(value)) {
    throw new Error("invalid_color");
  }

  return value;
}

export function assertDevelopmentLevel(value: unknown): DevelopmentLevel {
  if (!isDevelopmentLevel(value)) {
    throw new Error("invalid_level");
  }

  return value;
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

export function assertGameActive(game: Readonly<SplendorGameState>): void {
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
  context: CommandAvailabilityContext<SplendorGameState>,
): string {
  assertGameActive(context.game);
  return assertActivePlayer(context.runtime, context.actorId);
}
