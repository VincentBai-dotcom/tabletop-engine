import type { GameEvent } from "../types/event";
import type { ProgressionSegmentState } from "../types/progression";

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

export function createSegmentExitedEvent(
  segment: ProgressionSegmentState,
): GameEvent<"runtime", "segment_exited", Record<string, unknown>> {
  return {
    category: "runtime",
    type: "segment_exited",
    payload: {
      segmentId: segment.id,
      kind: segment.kind ?? null,
      ownerId: segment.ownerId ?? null,
    },
  };
}

export function createSegmentEnteredEvent(
  segment: ProgressionSegmentState,
): GameEvent<"runtime", "segment_entered", Record<string, unknown>> {
  return {
    category: "runtime",
    type: "segment_entered",
    payload: {
      segmentId: segment.id,
      kind: segment.kind ?? null,
      ownerId: segment.ownerId ?? null,
    },
  };
}
