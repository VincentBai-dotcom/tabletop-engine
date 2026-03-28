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
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime extends RuntimeState = RuntimeState,
  TCommandInput extends CommandInput = CommandInput,
> {
  state: CanonicalState<CanonicalGameState, Runtime>;
  game: Readonly<FacadeGameState>;
  runtime: Readonly<Runtime>;
  commandInput: TCommandInput;
}

export type ValidationContext<
  FacadeGameState extends object = object,
  TCommandInput extends CommandInput = CommandInput,
> = {
  game: Readonly<FacadeGameState>;
  runtime: Readonly<RuntimeState>;
  commandInput: TCommandInput;
};

export interface InternalCommandAvailabilityContext<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime extends RuntimeState = RuntimeState,
> {
  state: CanonicalState<CanonicalGameState, Runtime>;
  game: Readonly<FacadeGameState>;
  runtime: Readonly<Runtime>;
  commandType: string;
  actorId?: string;
}

export type CommandAvailabilityContext<
  FacadeGameState extends object = object,
> = {
  game: Readonly<FacadeGameState>;
  runtime: Readonly<RuntimeState>;
  commandType: string;
  actorId?: string;
};

export interface InternalDiscoveryContext<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime extends RuntimeState = RuntimeState,
  TPartialCommandInput extends CommandInput = CommandInput,
> extends InternalCommandAvailabilityContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime
> {
  partialCommand: TPartialCommandInput;
}

export type DiscoveryContext<
  FacadeGameState extends object = object,
  TPartialCommandInput extends CommandInput = CommandInput,
> = CommandAvailabilityContext<FacadeGameState> & {
  partialCommand: TPartialCommandInput;
};

export interface CommandDiscoveryResult<Option = unknown> {
  step: string;
  options: Option[];
  complete?: boolean;
  nextPartialCommand?: CommandInput;
  metadata?: Record<string, unknown>;
}

export interface InternalExecuteContext<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime extends RuntimeState = RuntimeState,
  TCommandInput extends CommandInput = CommandInput,
> extends InternalValidationContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TCommandInput
> {
  game: FacadeGameState;
  runtime: Readonly<Runtime>;
  rng: RNGApi;
  setCurrentSegmentOwner(ownerId?: string): void;
  emitEvent(event: KernelEvent): void;
}

export type ExecuteContext<
  FacadeGameState extends object = object,
  TCommandInput extends CommandInput = CommandInput,
> = {
  game: FacadeGameState;
  runtime: Readonly<RuntimeState>;
  commandInput: TCommandInput;
  rng: RNGApi;
  setCurrentSegmentOwner(ownerId?: string): void;
  emitEvent(event: KernelEvent): void;
};

export interface InternalCommandDefinition<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime extends RuntimeState = RuntimeState,
  TCommandInput extends CommandInput = CommandInput,
> {
  commandId: string;
  isAvailable?(
    context: InternalCommandAvailabilityContext<
      CanonicalGameState,
      FacadeGameState,
      Runtime
    >,
  ): boolean;
  discover?(
    context: InternalDiscoveryContext<
      CanonicalGameState,
      FacadeGameState,
      Runtime,
      TCommandInput
    >,
  ): CommandDiscoveryResult | null;
  validate(
    context: InternalValidationContext<
      CanonicalGameState,
      FacadeGameState,
      Runtime,
      TCommandInput
    >,
  ): ValidationOutcome;
  execute(
    context: InternalExecuteContext<
      CanonicalGameState,
      FacadeGameState,
      Runtime,
      TCommandInput
    >,
  ): void;
}

export type CommandDefinition<
  FacadeGameState extends object = object,
  TCommandInput extends CommandInput = CommandInput,
> = {
  commandId: string;
  isAvailable?(context: CommandAvailabilityContext<FacadeGameState>): boolean;
  discover?(
    context: DiscoveryContext<FacadeGameState, TCommandInput>,
  ): CommandDiscoveryResult | null;
  validate(
    context: ValidationContext<FacadeGameState, TCommandInput>,
  ): ValidationOutcome;
  execute(context: ExecuteContext<FacadeGameState, TCommandInput>): void;
};
