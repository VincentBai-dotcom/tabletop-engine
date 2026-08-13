import type {
  CommandBuilder,
  CommandBuilderAccumulator,
  CommandBuilderBaseConfig,
  CommandSchema,
  DefinedCommand,
  DiscoverableCommandDefinition,
  DiscoveryDefinition,
  DiscoveryInitialInput,
  DiscoveryStepBuilder,
  DiscoveryStepContext,
  DiscoveryStepInitialBuilder,
  DiscoveryStepInputBuilder,
  DiscoveryStepDefinition,
  DiscoveryStepResolveFn,
  DiscoveryStepReadyBuilder,
  DiscoveryStepResolvedBuilder,
  NonDiscoverableCommandAccumulator,
  NonDiscoverableCommandDefinition,
  AnyDiscoveryStepDefinition,
} from "./types/command";
import { commandDefinitionBrand as brand } from "./types/command";
import { assertSerializableSchema } from "./schema";
import type { EventRegistry, EmptyEventRegistry } from "./events/registry";

export interface CommandFactory<
  HydratedState extends object,
  TEventRegistry extends EventRegistry = EmptyEventRegistry,
> {
  <TCommandId extends string, TCommandInput extends Record<string, unknown>>(
    config: CommandBuilderBaseConfig<TCommandId, TCommandInput>,
  ): CommandBuilder<
    HydratedState,
    TCommandInput,
    never,
    readonly AnyDiscoveryStepDefinition[],
    false,
    false,
    false,
    false,
    TEventRegistry,
    TCommandId
  >;
}

type DiscoveryStepAccumulator = {
  stepId: string;
  initial: boolean;
  inputSchema?: CommandSchema<Record<string, unknown>>;
  outputSchema?: CommandSchema<Record<string, unknown>>;
  resolve?: (...args: unknown[]) => unknown;
};

function createDiscoveryStepBuilder<
  HydratedState extends object,
  TCommandInput extends Record<string, unknown>,
  TStepId extends string,
  TSteps extends readonly DiscoveryStepDefinition<object>[] =
    readonly DiscoveryStepDefinition<object>[],
>(
  stepId: TStepId,
): DiscoveryStepBuilder<HydratedState, TCommandInput, TSteps, TStepId> {
  const stepState: DiscoveryStepAccumulator = {
    stepId,
    initial: false,
  };

  function createResolvedBuilder<
    TInput extends Record<string, unknown>,
    TOutput extends Record<string, unknown>,
    TInitial extends boolean,
  >(): DiscoveryStepResolvedBuilder<
    HydratedState,
    TCommandInput,
    TSteps,
    TStepId,
    TInput,
    TOutput,
    TInitial
  > {
    return {
      build() {
        if (!stepState.inputSchema) {
          throw new Error(
            `command_builder_missing_discovery_input_schema:${stepState.stepId}`,
          );
        }

        if (!stepState.outputSchema) {
          throw new Error(
            `command_builder_missing_discovery_output_schema:${stepState.stepId}`,
          );
        }

        if (!stepState.resolve) {
          throw new Error(
            `command_builder_missing_discovery_resolve:${stepState.stepId}`,
          );
        }

        return {
          stepId: stepState.stepId as TStepId,
          initial: stepState.initial as TInitial,
          inputSchema: stepState.inputSchema,
          outputSchema: stepState.outputSchema,
          resolve: stepState.resolve,
        } as unknown as DiscoveryStepDefinition<
          HydratedState,
          TStepId,
          TInput,
          TOutput,
          TInitial,
          DiscoveryStepResolveFn<
            HydratedState,
            TCommandInput,
            TSteps,
            TInput,
            TOutput
          >
        >;
      },
    };
  }

  function createReadyBuilder<
    TInput extends Record<string, unknown>,
    TOutput extends Record<string, unknown>,
    TInitial extends boolean,
  >(): DiscoveryStepReadyBuilder<
    HydratedState,
    TCommandInput,
    TSteps,
    TStepId,
    TInput,
    TOutput,
    TInitial
  > {
    return {
      resolve(resolve) {
        stepState.resolve = resolve as (...args: unknown[]) => unknown;
        return createResolvedBuilder<TInput, TOutput, TInitial>();
      },
    };
  }

  function createInputBuilder<
    TInitial extends boolean,
    TInput extends Record<string, unknown>,
  >(): DiscoveryStepInputBuilder<
    HydratedState,
    TCommandInput,
    TSteps,
    TStepId,
    TInput,
    TInitial
  > {
    return {
      output<TNextOutput extends Record<string, unknown>>(
        schema: CommandSchema<TNextOutput>,
      ) {
        assertSerializableSchema(schema);
        stepState.outputSchema = schema;
        return createReadyBuilder<TInput, TNextOutput, TInitial>();
      },
    };
  }

  function createStepBuilder(): DiscoveryStepBuilder<
    HydratedState,
    TCommandInput,
    TSteps,
    TStepId
  > {
    return {
      initial() {
        stepState.initial = true;
        return createInitialBuilder();
      },

      input<TNextInput extends Record<string, unknown>>(
        schema: CommandSchema<TNextInput>,
      ) {
        assertSerializableSchema(schema);
        stepState.inputSchema = schema;
        return createInputBuilder<false, TNextInput>();
      },
    };
  }

  function createInitialBuilder(): DiscoveryStepInitialBuilder<
    HydratedState,
    TCommandInput,
    TSteps,
    TStepId
  > {
    return {
      input<TNextInput extends Record<string, unknown>>(
        schema: CommandSchema<TNextInput>,
      ) {
        assertSerializableSchema(schema);
        stepState.inputSchema = schema;
        return createInputBuilder<true, TNextInput>();
      },
    };
  }

  return createStepBuilder();
}

export function createCommandFactory<
  HydratedState extends object,
  TEventRegistry extends EventRegistry = EmptyEventRegistry,
>() {
  function brandCommandDefinition<
    TCommandInput extends Record<string, unknown>,
    TDiscoveryInput extends Record<string, unknown> = TCommandInput,
    TSteps extends readonly AnyDiscoveryStepDefinition[] =
      readonly AnyDiscoveryStepDefinition[],
    TCommandId extends string = string,
  >(
    definition:
      | NonDiscoverableCommandDefinition<
          HydratedState,
          TCommandInput,
          TCommandId
        >
      | DiscoverableCommandDefinition<
          HydratedState,
          TCommandInput,
          TDiscoveryInput,
          TSteps,
          TCommandId
        >,
  ): DefinedCommand<
    HydratedState,
    TCommandInput,
    TDiscoveryInput,
    TSteps,
    TCommandId
  > {
    return Object.defineProperty(definition, brand, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    }) as DefinedCommand<
      HydratedState,
      TCommandInput,
      TDiscoveryInput,
      TSteps,
      TCommandId
    >;
  }

  function finalizeDiscoveryDefinition<
    TSteps extends readonly DiscoveryStepDefinition<
      HydratedState,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
      boolean,
      (
        context: DiscoveryStepContext<HydratedState, Record<string, unknown>>,
      ) => unknown
    >[],
  >(steps: TSteps): DiscoveryDefinition<TSteps> {
    if (steps.length === 0) {
      throw new Error("command_builder_missing_discovery_step");
    }

    const seenStepIds = new Set<string>();
    let initialStepId: string | null = null;

    for (const step of steps) {
      if (seenStepIds.has(step.stepId)) {
        throw new Error(`duplicate_discovery_step_id:${step.stepId}`);
      }
      seenStepIds.add(step.stepId);

      if (step.initial) {
        if (initialStepId !== null) {
          throw new Error("command_builder_duplicate_initial_discovery_step");
        }
        initialStepId = step.stepId;
      }
    }

    if (initialStepId === null) {
      throw new Error("command_builder_missing_initial_discovery_step");
    }

    return {
      startStep: initialStepId,
      steps,
    };
  }

  // A single generic parameter over the accumulator value, rather than one
  // positional type parameter per builder flag/type. TS can infer `TAcc`
  // entirely from the argument at each recursive call below, so callers
  // never restate the 8 positional args that used to accompany every
  // `.discoverable()`/`.isAvailable()`/`.validate()`/`.execute()` step — the
  // Accumulator* helpers below just read the relevant piece back out of it.
  type BuilderAccumulator = CommandBuilderAccumulator<
    HydratedState,
    Record<string, unknown>,
    Record<string, unknown>,
    boolean,
    readonly AnyDiscoveryStepDefinition[],
    string
  >;

  type AccumulatorCommandId<TAcc extends BuilderAccumulator> = TAcc extends {
    commandId: infer TId extends string;
  }
    ? TId
    : string;

  type AccumulatorCommandInput<TAcc extends BuilderAccumulator> = TAcc extends {
    commandSchema: CommandSchema<infer TInput>;
  }
    ? TInput
    : Record<string, unknown>;

  type AccumulatorSteps<TAcc extends BuilderAccumulator> = TAcc extends {
    discovery: DiscoveryDefinition<infer TSteps>;
  }
    ? TSteps
    : readonly AnyDiscoveryStepDefinition[];

  type AccumulatorHasDiscovery<TAcc extends BuilderAccumulator> = TAcc extends {
    discovery: DiscoveryDefinition<readonly AnyDiscoveryStepDefinition[]>;
  }
    ? true
    : false;

  type AccumulatorDiscoveryInput<TAcc extends BuilderAccumulator> =
    AccumulatorHasDiscovery<TAcc> extends true
      ? DiscoveryInitialInput<AccumulatorSteps<TAcc>>
      : AccumulatorCommandInput<TAcc>;

  type AccumulatorHasAvailability<TAcc extends BuilderAccumulator> =
    TAcc extends { isAvailable: (...args: never[]) => unknown } ? true : false;

  type AccumulatorHasValidate<TAcc extends BuilderAccumulator> = TAcc extends {
    validate: (...args: never[]) => unknown;
  }
    ? true
    : false;

  type AccumulatorHasExecute<TAcc extends BuilderAccumulator> = TAcc extends {
    execute: (...args: never[]) => unknown;
  }
    ? true
    : false;

  function createBuilder<TAcc extends BuilderAccumulator>(
    accumulator: TAcc,
  ): CommandBuilder<
    HydratedState,
    AccumulatorCommandInput<TAcc>,
    AccumulatorDiscoveryInput<TAcc>,
    AccumulatorSteps<TAcc>,
    AccumulatorHasDiscovery<TAcc>,
    AccumulatorHasAvailability<TAcc>,
    AccumulatorHasValidate<TAcc>,
    AccumulatorHasExecute<TAcc>,
    TEventRegistry,
    AccumulatorCommandId<TAcc>
  > {
    return {
      discoverable<
        const TNextSteps extends readonly [
          DiscoveryStepDefinition<object>,
          ...DiscoveryStepDefinition<object>[],
        ],
      >(
        configure: (
          step: <TStepId extends string>(
            stepId: TStepId,
          ) => DiscoveryStepBuilder<
            HydratedState,
            AccumulatorCommandInput<TAcc>,
            readonly AnyDiscoveryStepDefinition[],
            TStepId
          >,
        ) => TNextSteps,
      ) {
        function discoveryStepFactory<TStepId extends string>(stepId: TStepId) {
          return createDiscoveryStepBuilder<
            HydratedState,
            AccumulatorCommandInput<TAcc>,
            TStepId
          >(stepId);
        }

        const steps = configure(discoveryStepFactory);
        const discovery = finalizeDiscoveryDefinition(steps);

        return createBuilder({ ...accumulator, discovery });
      },

      isAvailable(isAvailable) {
        return createBuilder({ ...accumulator, isAvailable });
      },

      validate(validate) {
        return createBuilder({ ...accumulator, validate });
      },

      execute(execute) {
        return createBuilder({ ...accumulator, execute });
      },

      build() {
        if (!accumulator.validate) {
          throw new Error("command_builder_missing_validate");
        }

        if (!accumulator.execute) {
          throw new Error("command_builder_missing_execute");
        }

        return brandCommandDefinition({
          ...accumulator,
          validate: accumulator.validate,
          execute: accumulator.execute,
        } as
          | NonDiscoverableCommandDefinition<
              HydratedState,
              AccumulatorCommandInput<TAcc>,
              AccumulatorCommandId<TAcc>
            >
          | DiscoverableCommandDefinition<
              HydratedState,
              AccumulatorCommandInput<TAcc>,
              AccumulatorDiscoveryInput<TAcc>,
              AccumulatorSteps<TAcc>,
              AccumulatorCommandId<TAcc>
            >);
      },
    } as CommandBuilder<
      HydratedState,
      AccumulatorCommandInput<TAcc>,
      AccumulatorDiscoveryInput<TAcc>,
      AccumulatorSteps<TAcc>,
      AccumulatorHasDiscovery<TAcc>,
      AccumulatorHasAvailability<TAcc>,
      AccumulatorHasValidate<TAcc>,
      AccumulatorHasExecute<TAcc>,
      TEventRegistry,
      AccumulatorCommandId<TAcc>
    >;
  }

  function defineCommand<
    TCommandId extends string,
    TCommandInput extends Record<string, unknown>,
  >(
    config: CommandBuilderBaseConfig<TCommandId, TCommandInput>,
  ): CommandBuilder<
    HydratedState,
    TCommandInput,
    never,
    readonly AnyDiscoveryStepDefinition[],
    false,
    false,
    false,
    false,
    TEventRegistry,
    TCommandId
  > {
    assertSerializableSchema(config.commandSchema);

    return createBuilder({
      commandId: config.commandId,
      commandSchema: config.commandSchema,
    } satisfies NonDiscoverableCommandAccumulator<
      HydratedState,
      TCommandInput,
      TCommandId
    >);
  }

  return defineCommand;
}
