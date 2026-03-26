import type { KernelEvent } from "./event";
import type { ValidationOutcome } from "./result";
import type { CanonicalState, RuntimeState } from "./state";
import type { RNGApi } from "./rng";

export interface Command<
  Payload extends Record<string, unknown> = Record<string, unknown>,
> {
  type: string;
  actorId?: string;
  payload?: Payload;
}

export interface ValidationContext<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
  Cmd extends Command = Command,
> {
  state: CanonicalState<GameState, Runtime>;
  command: Cmd;
}

export interface CommandAvailabilityContext<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
> {
  state: CanonicalState<GameState, Runtime>;
  commandType: string;
  actorId?: string;
}

export interface DiscoveryContext<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
  PartialCmd extends Command = Command,
> extends CommandAvailabilityContext<GameState, Runtime> {
  partialCommand: PartialCmd;
}

export interface CommandDiscoveryResult<Option = unknown> {
  step: string;
  options: Option[];
  complete?: boolean;
  nextPartialCommand?: Command;
  metadata?: Record<string, unknown>;
}

export interface ExecuteContext<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
  Cmd extends Command = Command,
> extends ValidationContext<GameState, Runtime, Cmd> {
  game: GameState;
  runtime: Readonly<Runtime>;
  rng: RNGApi;
  setCurrentSegmentOwner(ownerId?: string): void;
  emitEvent(event: KernelEvent): void;
}

export interface CommandDefinition<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
  Cmd extends Command = Command,
> {
  commandId: string;
  isAvailable?(
    context: CommandAvailabilityContext<GameState, Runtime>,
  ): boolean;
  discover?(
    context: DiscoveryContext<GameState, Runtime, Cmd>,
  ): CommandDiscoveryResult | null;
  validate(
    context: ValidationContext<GameState, Runtime, Cmd>,
  ): ValidationOutcome;
  execute(context: ExecuteContext<GameState, Runtime, Cmd>): void;
}
