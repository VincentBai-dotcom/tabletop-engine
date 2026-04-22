export function subtractMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() - milliseconds);
}

export function timestampBefore(
  timestamp: Date | null,
  threshold: Date,
): boolean {
  return timestamp !== null && timestamp.getTime() < threshold.getTime();
}
