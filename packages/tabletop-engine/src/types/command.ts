import type { TSchema } from "@sinclair/typebox";
import type { FieldType } from "../schema";
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
  actorId: string;
  input: Input;
}

type CommandData = Record<string, unknown>;
type DiscoveryData = Record<string, unknown>;

export type CommandFromSchema<TInput extends CommandData = CommandData> =
  Command<TInput>;

export interface Discovery<Input extends DiscoveryData = DiscoveryData> {
  type: string;
  actorId: string;
  step: string;
  input: Input;
}

export type CommandSchema<TInput extends CommandData = CommandData> = {
  readonly static: TInput;
  readonly kind: "object";
  readonly properties: Record<string, FieldType>;
  readonly schema?: TSchema;
};

export type CommandBuilderBaseConfig<
  TCommandInput extends CommandData = CommandData,
> = {
  commandId: string;
  commandSchema: CommandSchema<TCommandInput>;
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

export type DiscoveryStepOption<
  TNextInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
> = {
  id: string;
  output: TOutput;
  nextInput: TNextInput;
  nextStep: string;
};

export type DiscoveryOption<
  TNextInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
> = DiscoveryStepOption<TNextInput, TOutput>;

export type DiscoveryStepComplete<TCommandInput extends CommandData> = {
  complete: true;
  input: TCommandInput;
};

export type DiscoveryStepResult<
  TNextInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
  TCommandInput extends CommandData = CommandData,
> =
  | DiscoveryStepOption<TNextInput, TOutput>[]
  | DiscoveryStepComplete<TCommandInput>;

export type DiscoveryStepResolvedOption<
  TNextInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
> = Omit<DiscoveryStepOption<TNextInput, TOutput>, "nextStep"> & {
  nextStep: string;
};

export interface DiscoveryStepContext<
  FacadeGameState extends object = object,
  TDiscovery extends DiscoveryData = DiscoveryData,
> extends CommandAvailabilityContext<FacadeGameState> {
  discovery: Discovery<TDiscovery>;
  input: TDiscovery;
}

export interface DiscoveryStepDefinition<
  FacadeGameState extends object = object,
  TInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
  TInitial extends boolean = boolean,
> {
  stepId: string;
  initial: TInitial;
  inputSchema: CommandSchema<TInput>;
  outputSchema: CommandSchema<TOutput>;
  resolve(
    context: DiscoveryStepContext<FacadeGameState, TInput>,
  ): DiscoveryStepResult<DiscoveryData, TOutput, CommandData> | null;
}

export type DiscoveryStepBuilder<FacadeGameState extends object = object> = {
  initial(): DiscoveryStepInitialBuilder<FacadeGameState>;
  input<TNextInput extends DiscoveryData>(
    schema: CommandSchema<TNextInput>,
  ): DiscoveryStepInputBuilder<FacadeGameState, TNextInput>;
};

export type DiscoveryStepInitialBuilder<
  FacadeGameState extends object = object,
> = {
  input<TNextInput extends DiscoveryData>(
    schema: CommandSchema<TNextInput>,
  ): DiscoveryStepInputBuilder<FacadeGameState, TNextInput, true>;
};

export type DiscoveryStepInputBuilder<
  FacadeGameState extends object = object,
  TInput extends DiscoveryData = DiscoveryData,
  TInitial extends boolean = false,
> = {
  output<TNextOutput extends DiscoveryData>(
    schema: CommandSchema<TNextOutput>,
  ): DiscoveryStepReadyBuilder<FacadeGameState, TInput, TNextOutput, TInitial>;
};

export type DiscoveryStepReadyBuilder<
  FacadeGameState extends object = object,
  TInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
  TInitial extends boolean = false,
> = {
  resolve(
    resolve: (
      context: DiscoveryStepContext<FacadeGameState, TInput>,
    ) => DiscoveryStepResult<DiscoveryData, TOutput, CommandData> | null,
  ): DiscoveryStepResolvedBuilder<FacadeGameState, TInput, TOutput, TInitial>;
};

export type DiscoveryStepResolvedBuilder<
  FacadeGameState extends object = object,
  TInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
  TInitial extends boolean = false,
> = {
  build(): DiscoveryStepDefinition<FacadeGameState, TInput, TOutput, TInitial>;
};

export interface DiscoveryDefinition<FacadeGameState extends object = object> {
  startStep: string;
  steps: DiscoveryStepDefinition<
    FacadeGameState,
    DiscoveryData,
    DiscoveryData,
    boolean
  >[];
}

export type DiscoverableCommandConfig<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
  TDiscoveryInput extends DiscoveryData = DiscoveryData,
> = {
  commandId: string;
  commandSchema: CommandSchema<TCommandInput>;
  discovery: DiscoveryDefinition<FacadeGameState>;
  _discoveryInput?: TDiscoveryInput;
} & CommandLifecycleMethods<FacadeGameState, TCommandInput>;

export type NonDiscoverableCommandConfig<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
> = {
  commandId: string;
  commandSchema: CommandSchema<TCommandInput>;
  discovery?: never;
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
  | DiscoverableCommandConfig<FacadeGameState, TCommandInput, TDiscoveryInput>
  | NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>;

export type CommandDefinition<FacadeGameState extends object = object> = {
  commandId: string;
  commandSchema: CommandSchema<Record<string, unknown>>;
  discovery?: DiscoveryDefinition<FacadeGameState>;
  isAvailable?(context: CommandAvailabilityContext<FacadeGameState>): boolean;
  validate(
    context: ValidationContext<FacadeGameState, Command>,
  ): ValidationOutcome;
  execute(context: ExecuteContext<FacadeGameState, Command>): void;
};

export type NonDiscoverableCommandAccumulator<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
> = Pick<
  NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>,
  "commandId" | "commandSchema"
> &
  Partial<
    Pick<
      NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>,
      "isAvailable" | "validate" | "execute"
    >
  >;

export type DiscoverableCommandAccumulator<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
  TDiscoveryInput extends DiscoveryData = TCommandInput,
> = Pick<
  DiscoverableCommandConfig<FacadeGameState, TCommandInput, TDiscoveryInput>,
  "commandId" | "commandSchema" | "discovery"
> &
  Partial<
    Pick<
      DiscoverableCommandConfig<
        FacadeGameState,
        TCommandInput,
        TDiscoveryInput
      >,
      "isAvailable" | "validate" | "execute"
    >
  >;

export type CommandBuilderAccumulator<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
  TDiscoveryInput extends DiscoveryData = TCommandInput,
  THasDiscovery extends boolean = false,
> = THasDiscovery extends true
  ? DiscoverableCommandAccumulator<
      FacadeGameState,
      TCommandInput,
      TDiscoveryInput
    >
  : NonDiscoverableCommandAccumulator<FacadeGameState, TCommandInput>;

type NoBuilderMethod = Record<never, never>;

type OptionalBuilderMethod<
  Enabled extends boolean,
  TMethod,
> = Enabled extends true ? NoBuilderMethod : TMethod;

type BuildCommandInput<
  TCommandInput extends CommandData,
  TDiscoveryInput extends DiscoveryData | never,
  THasDiscovery extends boolean,
> = THasDiscovery extends true ? TDiscoveryInput : TCommandInput;

type DiscoveryInitialInput<
  TSteps extends readonly DiscoveryStepDefinition<
    object,
    DiscoveryData,
    DiscoveryData,
    boolean
  >[],
> =
  Extract<TSteps[number], { initial: true }> extends DiscoveryStepDefinition<
    object,
    infer TInput,
    DiscoveryData,
    true
  >
    ? TInput
    : never;

type BuildBuilderMethod<
  FacadeGameState extends object,
  TCommandInput extends CommandData,
  TDiscoveryInput extends DiscoveryData,
  THasDiscovery extends boolean,
  THasValidate extends boolean,
  THasExecute extends boolean,
> = THasValidate extends true
  ? THasExecute extends true
    ? {
        build(): DefinedCommand<
          FacadeGameState,
          TCommandInput,
          BuildCommandInput<TCommandInput, TDiscoveryInput, THasDiscovery>
        >;
      }
    : NoBuilderMethod
  : NoBuilderMethod;

export type CommandBuilder<
  FacadeGameState extends object = object,
  TCommandInput extends CommandData = CommandData,
  TDiscoveryInput extends DiscoveryData = never,
  THasDiscovery extends boolean = false,
  THasAvailability extends boolean = false,
  THasValidate extends boolean = false,
  THasExecute extends boolean = false,
> = OptionalBuilderMethod<
  THasDiscovery,
  {
    discoverable<
      TSteps extends readonly [
        DiscoveryStepDefinition<
          FacadeGameState,
          DiscoveryData,
          DiscoveryData,
          boolean
        >,
        ...DiscoveryStepDefinition<
          FacadeGameState,
          DiscoveryData,
          DiscoveryData,
          boolean
        >[],
      ],
    >(
      ...steps: TSteps
    ): CommandBuilder<
      FacadeGameState,
      TCommandInput,
      DiscoveryInitialInput<TSteps>,
      true,
      THasAvailability,
      THasValidate,
      THasExecute
    >;
  }
> &
  OptionalBuilderMethod<
    THasAvailability,
    {
      isAvailable(
        isAvailable: (
          context: CommandAvailabilityContext<FacadeGameState>,
        ) => boolean,
      ): CommandBuilder<
        FacadeGameState,
        TCommandInput,
        TDiscoveryInput,
        THasDiscovery,
        true,
        THasValidate,
        THasExecute
      >;
    }
  > &
  OptionalBuilderMethod<
    THasValidate,
    {
      validate(
        validate: (
          context: ValidationContext<
            FacadeGameState,
            CommandFromSchema<TCommandInput>
          >,
        ) => ValidationOutcome,
      ): CommandBuilder<
        FacadeGameState,
        TCommandInput,
        TDiscoveryInput,
        THasDiscovery,
        THasAvailability,
        true,
        THasExecute
      >;
    }
  > &
  OptionalBuilderMethod<
    THasExecute,
    {
      execute(
        execute: (
          context: ExecuteContext<
            FacadeGameState,
            CommandFromSchema<TCommandInput>
          >,
        ) => void,
      ): CommandBuilder<
        FacadeGameState,
        TCommandInput,
        TDiscoveryInput,
        THasDiscovery,
        THasAvailability,
        THasValidate,
        true
      >;
    }
  > &
  BuildBuilderMethod<
    FacadeGameState,
    TCommandInput,
    TDiscoveryInput,
    THasDiscovery,
    THasValidate,
    THasExecute
  >;

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
  actorId: string;
}

export type CommandAvailabilityContext<
  FacadeGameState extends object = object,
> = {
  game: Readonly<FacadeGameState>;
  runtime: Readonly<RuntimeState>;
  commandType: string;
  actorId: string;
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
  input: TDiscovery;
}

export type DiscoveryContext<
  FacadeGameState extends object = object,
  TDiscovery extends DiscoveryData = DiscoveryData,
> = CommandAvailabilityContext<FacadeGameState> & {
  discovery: Discovery<TDiscovery>;
};

export type CommandDiscoveryResult<
  TStep extends string = string,
  TNextInput extends DiscoveryData = DiscoveryData,
  TOutput extends DiscoveryData = DiscoveryData,
  TCommandInput extends CommandData = CommandData,
> =
  | {
      complete: false;
      step: TStep;
      options: Array<DiscoveryStepResolvedOption<TNextInput, TOutput>>;
    }
  | {
      complete: true;
      input: TCommandInput;
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
  emitEvent(event: GameEvent): void;
};

export interface InternalCommandDefinition<
  CanonicalGameState extends object = object,
  FacadeGameState extends object = CanonicalGameState,
  Runtime extends RuntimeState = RuntimeState,
  TCommandInput extends CommandData = CommandData,
> {
  commandId: string;
  commandSchema: CommandSchema<TCommandInput>;
  discovery?: DiscoveryDefinition<FacadeGameState>;
  isAvailable?(
    context: InternalCommandAvailabilityContext<
      CanonicalGameState,
      FacadeGameState,
      Runtime
    >,
  ): boolean;
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
