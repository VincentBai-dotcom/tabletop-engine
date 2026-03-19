import type { Command } from "../types/command";
import type { KernelEvent } from "../types/event";
import type { ExecutionResult } from "../types/result";
import type { CanonicalState } from "../types/state";
import type { ReplayRecord, Snapshot } from "../types/snapshot";
import { restoreSnapshot } from "../snapshot/snapshot";

export function createReplayRecord<
  State extends CanonicalState = CanonicalState,
  Cmd extends Command = Command,
  Ev extends KernelEvent = KernelEvent,
>(initialSnapshot: Snapshot<State>): ReplayRecord<State, Cmd, Ev> {
  return {
    initialSnapshot,
    commands: [],
    events: [],
    checkpoints: [],
  };
}

export function appendReplayStep<
  State extends CanonicalState = CanonicalState,
  Cmd extends Command = Command,
  Ev extends KernelEvent = KernelEvent,
>(
  record: ReplayRecord<State, Cmd, Ev>,
  command: Cmd,
  result: ExecutionResult<State>,
): ReplayRecord<State, Cmd, Ev> {
  return {
    ...record,
    commands: [...record.commands, command],
    events: [...record.events, ...(result.events as Ev[])],
  };
}

export function replayRecord<
  State extends CanonicalState = CanonicalState,
  Cmd extends Command = Command,
>(
  kernel: {
    executeCommand(state: State, command: Cmd): ExecutionResult<State>;
  },
  record: ReplayRecord<State, Cmd>,
): State {
  let state = restoreSnapshot(record.initialSnapshot);

  for (const command of record.commands) {
    state = kernel.executeCommand(state, command).state;
  }

  return state;
}
