import type { KernelEvent } from "./event";
import type { ValidationOutcome } from "./result";
import type { CanonicalState, RuntimeState } from "./state";

export interface Command<
  Payload extends Record<string, unknown> = Record<string, unknown>,
> {
  type: string;
  actorId?: string;
  payload?: Payload;
}

export interface ValidationContext<
  GameState = Record<string, unknown>,
  Runtime extends RuntimeState = RuntimeState,
  Cmd extends Command = Command,
> {
  state: CanonicalState<GameState, Runtime>;
  command: Cmd;
}

export interface ExecuteContext<
  GameState = Record<string, unknown>,
  Runtime extends RuntimeState = RuntimeState,
  Cmd extends Command = Command,
> extends ValidationContext<GameState, Runtime, Cmd> {
  game: GameState;
  runtime: Readonly<Runtime>;
  emitEvent(event: KernelEvent): void;
}

export interface CommandDefinition<
  GameState = Record<string, unknown>,
  Runtime extends RuntimeState = RuntimeState,
  Cmd extends Command = Command,
> {
  validate(
    context: ValidationContext<GameState, Runtime, Cmd>,
  ): ValidationOutcome;
  execute(context: ExecuteContext<GameState, Runtime, Cmd>): void;
}
