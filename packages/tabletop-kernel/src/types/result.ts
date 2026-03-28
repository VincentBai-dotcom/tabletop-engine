import type { KernelEvent } from "./event";
import type { CanonicalState } from "./state";

export interface ValidationResult {
  ok: true;
}

export interface ValidationError {
  ok: false;
  reason: string;
  metadata?: unknown;
}

export type ValidationOutcome = ValidationResult | ValidationError;

export interface ExecutionSuccess<
  State extends CanonicalState = CanonicalState,
> {
  ok: true;
  state: State;
  events: KernelEvent[];
}

export interface ExecutionFailure<
  State extends CanonicalState = CanonicalState,
> {
  ok: false;
  state: State;
  reason: string;
  metadata?: unknown;
  events: KernelEvent[];
}

export type ExecutionResult<State extends CanonicalState = CanonicalState> =
  | ExecutionSuccess<State>
  | ExecutionFailure<State>;
