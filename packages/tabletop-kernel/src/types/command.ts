import type { KernelEvent } from "./event";
import type { ValidationOutcome } from "./result";
import type { CanonicalState, RuntimeState } from "./state";
import type { RNGApi } from "./rng";

export interface CommandInput<
  Payload extends Record<string, unknown> = Record<string, unknown>,
> {
  type: string;
  actorId?: string;
  payload?: Payload;
}

export interface InternalValidationContext<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
  Cmd extends CommandInput = CommandInput,
> {
  state: CanonicalState<GameState, Runtime>;
  commandInput: Cmd;
}

export type ValidationContext<
  GameState extends object = object,
  Cmd extends CommandInput = CommandInput,
> = InternalValidationContext<GameState, RuntimeState, Cmd>;

export interface InternalCommandAvailabilityContext<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
> {
  state: CanonicalState<GameState, Runtime>;
  commandType: string;
  actorId?: string;
}

export type CommandAvailabilityContext<GameState extends object = object> =
  InternalCommandAvailabilityContext<GameState, RuntimeState>;

export interface InternalDiscoveryContext<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
  PartialCmd extends CommandInput = CommandInput,
> extends InternalCommandAvailabilityContext<GameState, Runtime> {
  partialCommand: PartialCmd;
}

export type DiscoveryContext<
  GameState extends object = object,
  PartialCmd extends CommandInput = CommandInput,
> = InternalDiscoveryContext<GameState, RuntimeState, PartialCmd>;

export interface CommandDiscoveryResult<Option = unknown> {
  step: string;
  options: Option[];
  complete?: boolean;
  nextPartialCommand?: CommandInput;
  metadata?: Record<string, unknown>;
}

export interface InternalExecuteContext<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
  Cmd extends CommandInput = CommandInput,
> extends InternalValidationContext<GameState, Runtime, Cmd> {
  game: GameState;
  runtime: Readonly<Runtime>;
  rng: RNGApi;
  setCurrentSegmentOwner(ownerId?: string): void;
  emitEvent(event: KernelEvent): void;
}

export type ExecuteContext<
  GameState extends object = object,
  Cmd extends CommandInput = CommandInput,
> = InternalExecuteContext<GameState, RuntimeState, Cmd>;

export interface InternalCommandDefinition<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
  Cmd extends CommandInput = CommandInput,
> {
  commandId: string;
  isAvailable?(
    context: InternalCommandAvailabilityContext<GameState, Runtime>,
  ): boolean;
  discover?(
    context: InternalDiscoveryContext<GameState, Runtime, Cmd>,
  ): CommandDiscoveryResult | null;
  validate(
    context: InternalValidationContext<GameState, Runtime, Cmd>,
  ): ValidationOutcome;
  execute(context: InternalExecuteContext<GameState, Runtime, Cmd>): void;
}

export type CommandDefinition<
  GameState extends object = object,
  Cmd extends CommandInput = CommandInput,
> = InternalCommandDefinition<GameState, RuntimeState, Cmd>;
