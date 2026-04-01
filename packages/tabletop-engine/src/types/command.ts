import type { TSchema } from "@sinclair/typebox";
import type { GameEvent } from "./event";
import type { ValidationOutcome } from "./result";
import type { CanonicalState, RuntimeState } from "./state";
import type { RNGApi } from "./rng";

export const commandDefinitionBrand = Symbol(
  "tabletop-engine.command-definition",
);

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

export type CommandPayloadSchema<
  TPayload extends CommandPayload = CommandPayload,
> = {
  readonly static: TPayload;
  readonly schema?: TSchema;
};

type CommandLifecycleMethods<
  FacadeGameState extends object,
  TPayload extends CommandPayload,
> = {
  isAvailable?(context: CommandAvailabilityContext<FacadeGameState>): boolean;
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

type CommandDefinitionBrand = {
  readonly [commandDefinitionBrand]: true;
};

export type DiscoverableCommandConfig<
  FacadeGameState extends object = object,
  TPayload extends CommandPayload = CommandPayload,
  TDraft extends DiscoveryDraft = DiscoveryDraft,
> = {
  commandId: string;
  payloadSchema: CommandPayloadSchema<TPayload>;
  discoveryDraftSchema: CommandPayloadSchema<TDraft>;
  discover(
    context: DiscoveryContext<FacadeGameState, TDraft>,
  ): CommandDiscoveryResult<TDraft, TPayload> | null;
} & CommandLifecycleMethods<FacadeGameState, TPayload>;

export type NonDiscoverableCommandConfig<
  FacadeGameState extends object = object,
  TPayload extends CommandPayload = CommandPayload,
> = {
  commandId: string;
  payloadSchema: CommandPayloadSchema<TPayload>;
  discoveryDraftSchema?: never;
  discover?: never;
} & CommandLifecycleMethods<FacadeGameState, TPayload>;

export type DefinedCommand<
  FacadeGameState extends object = object,
  TPayload extends CommandPayload = CommandPayload,
  TDraft extends DiscoveryDraft = TPayload,
> = CommandDefinitionBrand &
  CommandDefinitionShape<FacadeGameState, TPayload, TDraft>;

export type CommandDefinitionShape<
  FacadeGameState extends object = object,
  TPayload extends CommandPayload = CommandPayload,
  TDraft extends DiscoveryDraft = TPayload,
> =
  | (DiscoverableCommandConfig<FacadeGameState, TPayload, TDraft> & {
      discoveryDraftSchema: CommandPayloadSchema<TDraft>;
    })
  | NonDiscoverableCommandConfig<FacadeGameState, TPayload>;

export type CommandDefinitionLike<FacadeGameState extends object = object> = {
  commandId: string;
  payloadSchema: CommandPayloadSchema<Record<string, unknown>>;
  discoveryDraftSchema?: CommandPayloadSchema<Record<string, unknown>>;
  isAvailable?(context: CommandAvailabilityContext<FacadeGameState>): boolean;
  discover?(
    context: DiscoveryContext<FacadeGameState, Record<string, unknown>>,
  ): CommandDiscoveryResult | null;
  validate(
    context: ValidationContext<FacadeGameState, CommandInput>,
  ): ValidationOutcome;
  execute(context: ExecuteContext<FacadeGameState, CommandInput>): void;
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
