import type { Command } from "../types/command";
import type {
  BuiltInProgressionCompletionPolicy,
  ProgressionCompletionContext,
  ProgressionCompletionPolicy,
} from "../types/progression";

export type {
  NormalizedProgressionDefinition,
  NormalizedProgressionSegmentDefinition,
} from "./progression-normalize";

export function evaluateCompletionPolicy<
  GameState extends object,
  Runtime,
  Cmd extends Command,
>(
  policy: ProgressionCompletionPolicy<GameState, Runtime, Cmd> | undefined,
  context: ProgressionCompletionContext<GameState, Runtime, Cmd>,
): boolean {
  if (!policy) {
    return false;
  }

  if (typeof policy === "function") {
    return policy(context);
  }

  return evaluateBuiltInCompletionPolicy(policy, context);
}

function evaluateBuiltInCompletionPolicy<
  GameState extends object,
  Runtime,
  Cmd extends Command,
>(
  policy: BuiltInProgressionCompletionPolicy,
  context: ProgressionCompletionContext<GameState, Runtime, Cmd>,
): boolean {
  void context;

  switch (policy) {
    case "after_successful_command":
      return true;
    case "manual_only":
      return false;
  }
}
