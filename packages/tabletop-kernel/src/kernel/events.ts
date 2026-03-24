import type { KernelEvent } from "../types/event";
import type { ProgressionSegmentState } from "../types/progression";

export interface EventCollector<Event extends KernelEvent = KernelEvent> {
  emit(event: Event): void;
  list(): Event[];
}

export function createEventCollector<
  Event extends KernelEvent = KernelEvent,
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
): KernelEvent<"runtime", "segment_exited", Record<string, unknown>> {
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
): KernelEvent<"runtime", "segment_entered", Record<string, unknown>> {
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
