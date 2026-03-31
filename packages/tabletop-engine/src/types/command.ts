import type { TSchema } from "@sinclair/typebox";
import type { GameEvent } from "./event";
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

type CommandPayload = Record<string, unknown>;
type DiscoveryDraft = Record<string, unknown>;

export type CommandInputFromSchema<
  TPayload extends CommandPayload = CommandPayload,
> = CommandInput<TPayload>;

export interface DiscoveryInput<
  TDraft extends DiscoveryDraft = DiscoveryDraft,
> {
  type: string;
  actorId?: string;
  draft?: TDraft;
}

type CommandPayloadSchema<TPayload extends CommandPayload = CommandPayload> = {
  readonly static: TPayload;
  readonly schema?: TSchema;
};

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
  TDraft extends DiscoveryDraft = DiscoveryDraft,
> extends InternalCommandAvailabilityContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime
> {
  discoveryInput: DiscoveryInput<TDraft>;
}

export type DiscoveryContext<
  FacadeGameState extends object = object,
  TDraft extends DiscoveryDraft = DiscoveryDraft,
> = CommandAvailabilityContext<FacadeGameState> & {
  discoveryInput: DiscoveryInput<TDraft>;
};

export interface DiscoveryOption<
  TDraft extends DiscoveryDraft = DiscoveryDraft,
> {
  id: string;
  nextDraft: TDraft;
  metadata?: Record<string, unknown>;
}

export type CommandDiscoveryResult<
  TDraft extends DiscoveryDraft = DiscoveryDraft,
  TPayload extends CommandPayload = CommandPayload,
> =
  | {
      complete: false;
      step: string;
      options: DiscoveryOption<TDraft>[];
      metadata?: Record<string, unknown>;
    }
  | {
      complete: true;
      payload: TPayload;
      metadata?: Record<string, unknown>;
    };

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
  emitEvent(event: GameEvent): void;
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
  emitEvent(event: GameEvent): void;
};

export interface InternalCommandDefinition<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime extends RuntimeState = RuntimeState,
  TPayload extends CommandPayload = CommandPayload,
  TDraft extends DiscoveryDraft = TPayload,
> {
  commandId: string;
  payloadSchema: CommandPayloadSchema<TPayload>;
  discoveryDraftSchema?: CommandPayloadSchema<TDraft>;
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
      TDraft
    >,
  ): CommandDiscoveryResult<TDraft, TPayload> | null;
  validate(
    context: InternalValidationContext<
      CanonicalGameState,
      FacadeGameState,
      Runtime,
      CommandInputFromSchema<TPayload>
    >,
  ): ValidationOutcome;
  execute(
    context: InternalExecuteContext<
      CanonicalGameState,
      FacadeGameState,
      Runtime,
      CommandInputFromSchema<TPayload>
    >,
  ): void;
}

export type CommandDefinition<
  FacadeGameState extends object = object,
  TPayload extends CommandPayload = CommandPayload,
  TDraft extends DiscoveryDraft = TPayload,
> = {
  commandId: string;
  payloadSchema: CommandPayloadSchema<TPayload>;
  discoveryDraftSchema?: CommandPayloadSchema<TDraft>;
  isAvailable?(context: CommandAvailabilityContext<FacadeGameState>): boolean;
  discover?(
    context: DiscoveryContext<FacadeGameState, TDraft>,
  ): CommandDiscoveryResult<TDraft, TPayload> | null;
  validate(
    context: ValidationContext<
      FacadeGameState,
      CommandInputFromSchema<TPayload>
    >,
  ): ValidationOutcome;
  execute(
    context: ExecuteContext<FacadeGameState, CommandInputFromSchema<TPayload>>,
  ): void;
};
