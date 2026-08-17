import type { ExecutionResult } from "./types.ts";
import { TransportError } from "./lifecycle.ts";

function fail(): never {
  throw new TransportError("server_error");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseExecutionResult(value: unknown): ExecutionResult {
  if (!isRecord(value) || typeof value.accepted !== "boolean") {
    fail();
  }
  const reason = value.reason;
  if (reason !== undefined && typeof reason !== "string") {
    fail();
  }
  return { accepted: value.accepted, reason };
}

export function parseCommandList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    fail();
  }
  const commands: string[] = [];
  for (const command of value) {
    if (typeof command !== "string") {
      fail();
    }
    commands.push(command);
  }
  return commands;
}

export interface SnapshotEnvelope {
  viewerId: string;
  version: number;
  view: unknown;
}

export function assertSnapshotEnvelope(
  value: unknown,
): asserts value is SnapshotEnvelope {
  if (
    !isRecord(value) ||
    typeof value.viewerId !== "string" ||
    typeof value.version !== "number"
  ) {
    fail();
  }
}

export interface EventEnvelope {
  category: "domain" | "runtime";
  type: string;
  payload: unknown;
}

export function assertEventEnvelope(
  value: unknown,
): asserts value is EventEnvelope {
  if (
    !isRecord(value) ||
    (value.category !== "domain" && value.category !== "runtime") ||
    typeof value.type !== "string"
  ) {
    fail();
  }
}

export function assertDiscoveryResult(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (!isRecord(value) || typeof value.complete !== "boolean") {
    fail();
  }
  if (
    value.complete === false &&
    (typeof value.step !== "string" || !Array.isArray(value.options))
  ) {
    fail();
  }
}
