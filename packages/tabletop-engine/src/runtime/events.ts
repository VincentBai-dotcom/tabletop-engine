import type { GameEvent } from "../types/event";
import type { CurrentStageState } from "../types/progression";

export interface EventCollector<Event extends GameEvent = GameEvent> {
  emit(event: Event): void;
  list(): Event[];
}

export function createEventCollector<
  Event extends GameEvent = GameEvent,
>(): EventCollector<Event> {
  const events: Event[] = [];

  return {
    emit(event) {
      events.push(event);
    },
    list() {
      return [...events];
    },
  };
}

export function createStageExitedEvent(
  stage: CurrentStageState,
): GameEvent<"runtime", "stage_exited", Record<string, unknown>> {
  return {
    category: "runtime",
    type: "stage_exited",
    payload: {
      stageId: stage.id,
      kind: stage.kind,
      activePlayerId:
        stage.kind === "activePlayer" ? stage.activePlayerId : null,
    },
  };
}

export function createStageEnteredEvent(
  stage: CurrentStageState,
): GameEvent<"runtime", "stage_entered", Record<string, unknown>> {
  return {
    category: "runtime",
    type: "stage_entered",
    payload: {
      stageId: stage.id,
      kind: stage.kind,
      activePlayerId:
        stage.kind === "activePlayer" ? stage.activePlayerId : null,
    },
  };
}
