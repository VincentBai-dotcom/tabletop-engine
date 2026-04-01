import type { TSchema } from "@sinclair/typebox";
import type { GameEvent } from "./event";
import type { RNGApi } from "./rng";
import type { ValidationOutcome } from "./result";
import type { CanonicalState, RuntimeState } from "./state";

export const commandDefinitionBrand = Symbol(
  "tabletop-engine.command-definition",
);

export interface Command<
  Input extends Record<string, unknown> = Record<string, unknown>,
> {
  type: string;
  actorId?: string;
  input?: Input;
}

type CommandData = Record<string, unknown>;
type DiscoveryData = Record<string, unknown>;

export type CommandFromSchema<TInput extends CommandData = CommandData> =
  Command<TInput>;

export interface Discovery<Input extends DiscoveryData = DiscoveryData> {
  type: string;
  actorId?: string;
  input?: Input;
}

export type CommandSchema<TInput extends CommandData = CommandData> = {
  readonly static: TInput;
  readonly schema?: TSchema;
};

type CommandLifecycleMethods<
  FacadeGameState extends object,
  TInput extends CommandData,
> = {
  isAvailable?(context: CommandAvailabilityContext<FacadeGameState>): boolean;
  validate(
    context: ValidationContext<FacadeGameState, CommandFromSchema<TInput>>,
  ): ValidationOutcome;
  execute(
    context: ExecuteContext<FacadeGameState, CommandFromSchema<TInput>>,
  ): void;
};

type CommandDefinitionBrand = {
  readonly [commandDefinitionBrand]: true;
};

export type DiscoverableCommandConfig<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
  TDiscoveryInput extends DiscoveryData = DiscoveryData,
> = {
  commandId: string;
  commandSchema: CommandSchema<TCommandInput>;
  discoverySchema: CommandSchema<TDiscoveryInput>;
  discover(
    context: DiscoveryContext<FacadeGameState, TDiscoveryInput>,
  ): CommandDiscoveryResult<TDiscoveryInput, TCommandInput> | null;
} & CommandLifecycleMethods<FacadeGameState, TCommandInput>;

export type NonDiscoverableCommandConfig<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
> = {
  commandId: string;
  commandSchema: CommandSchema<TCommandInput>;
  discoverySchema?: never;
  discover?: never;
} & CommandLifecycleMethods<FacadeGameState, TCommandInput>;

export type DefinedCommand<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
  TDiscoveryInput extends DiscoveryData = TCommandInput,
> = CommandDefinitionBrand &
  CommandDefinitionShape<FacadeGameState, TCommandInput, TDiscoveryInput>;

export type CommandDefinitionShape<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
  TDiscoveryInput extends DiscoveryData = TCommandInput,
> =
  | (DiscoverableCommandConfig<
      FacadeGameState,
      TCommandInput,
      TDiscoveryInput
    > & {
      discoverySchema: CommandSchema<TDiscoveryInput>;
    })
  | NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>;

export type CommandDefinitionLike<FacadeGameState extends object = object> = {
  commandId: string;
  commandSchema: CommandSchema<Record<string, unknown>>;
  discoverySchema?: CommandSchema<Record<string, unknown>>;
  isAvailable?(context: CommandAvailabilityContext<FacadeGameState>): boolean;
  discover?(
    context: DiscoveryContext<FacadeGameState, Record<string, unknown>>,
  ): CommandDiscoveryResult | null;
  validate(
    context: ValidationContext<FacadeGameState, Command>,
  ): ValidationOutcome;
  execute(context: ExecuteContext<FacadeGameState, Command>): void;
};

export interface InternalValidationContext<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime extends RuntimeState = RuntimeState,
  TCommand extends Command = Command,
> {
  state: CanonicalState<CanonicalGameState, Runtime>;
  game: Readonly<FacadeGameState>;
  runtime: Readonly<Runtime>;
  command: TCommand;
}

export type ValidationContext<
  FacadeGameState extends object = object,
  TCommand extends Command = Command,
> = {
  game: Readonly<FacadeGameState>;
  runtime: Readonly<RuntimeState>;
  command: TCommand;
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
  TDiscovery extends DiscoveryData = DiscoveryData,
> extends InternalCommandAvailabilityContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime
> {
  discovery: Discovery<TDiscovery>;
}

export type DiscoveryContext<
  FacadeGameState extends object = object,
  TDiscovery extends DiscoveryData = DiscoveryData,
> = CommandAvailabilityContext<FacadeGameState> & {
  discovery: Discovery<TDiscovery>;
};

export interface DiscoveryOption<
  TDiscovery extends DiscoveryData = DiscoveryData,
> {
  id: string;
  nextInput: TDiscovery;
  metadata?: Record<string, unknown>;
}

export type CommandDiscoveryResult<
  TDiscovery extends DiscoveryData = DiscoveryData,
  TCommandInput extends CommandData = CommandData,
> =
  | {
      complete: false;
      step: string;
      options: DiscoveryOption<TDiscovery>[];
      metadata?: Record<string, unknown>;
    }
  | {
      complete: true;
      input: TCommandInput;
      metadata?: Record<string, unknown>;
    };

export interface InternalExecuteContext<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime extends RuntimeState = RuntimeState,
  TCommand extends Command = Command,
> extends InternalValidationContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TCommand
> {
  game: FacadeGameState;
  runtime: Readonly<Runtime>;
  rng: RNGApi;
  setCurrentSegmentOwner(ownerId?: string): void;
  emitEvent(event: GameEvent): void;
}

export type ExecuteContext<
  FacadeGameState extends object = object,
  TCommand extends Command = Command,
> = {
  game: FacadeGameState;
  runtime: Readonly<RuntimeState>;
  command: TCommand;
  rng: RNGApi;
  setCurrentSegmentOwner(ownerId?: string): void;
  emitEvent(event: GameEvent): void;
};

export interface InternalCommandDefinition<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime extends RuntimeState = RuntimeState,
  TCommandInput extends CommandData = CommandData,
  TDiscoveryInput extends DiscoveryData = TCommandInput,
> {
  commandId: string;
  commandSchema: CommandSchema<TCommandInput>;
  discoverySchema?: CommandSchema<TDiscoveryInput>;
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
      TDiscoveryInput
    >,
  ): CommandDiscoveryResult<TDiscoveryInput, TCommandInput> | null;
  validate(
    context: InternalValidationContext<
      CanonicalGameState,
      FacadeGameState,
      Runtime,
      CommandFromSchema<TCommandInput>
    >,
  ): ValidationOutcome;
  execute(
    context: InternalExecuteContext<
      CanonicalGameState,
      FacadeGameState,
      Runtime,
      CommandFromSchema<TCommandInput>
    >,
  ): void;
}
