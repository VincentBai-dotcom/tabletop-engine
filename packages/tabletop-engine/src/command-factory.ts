import type {
  CommandBuilder,
  CommandBuilderAccumulator,
  CommandBuilderBaseConfig,
  CommandSchema,
  DefinedCommand,
  DiscoverableCommandAccumulator,
  DiscoverableCommandConfig,
  DiscoveryDefinition,
  DiscoveryStepBuilder,
  DiscoveryStepContext,
  DiscoveryStepInitialBuilder,
  DiscoveryStepInputBuilder,
  DiscoveryStepDefinition,
  DiscoveryStepResolveFn,
  DiscoveryStepReadyBuilder,
  DiscoveryStepResolvedBuilder,
  NonDiscoverableCommandAccumulator,
  NonDiscoverableCommandConfig,
} from "./types/command";
import { commandDefinitionBrand as brand } from "./types/command";
import { assertSerializableSchema } from "./schema";

export interface CommandFactory<FacadeGameState extends object> {
  <TCommandInput extends Record<string, unknown>>(
    config: CommandBuilderBaseConfig<TCommandInput>,
  ): CommandBuilder<FacadeGameState, TCommandInput>;
}

type DiscoveryStepAccumulator = {
  stepId: string;
  initial: boolean;
  inputSchema?: CommandSchema<Record<string, unknown>>;
  outputSchema?: CommandSchema<Record<string, unknown>>;
  resolve?: (...args: unknown[]) => unknown;
};

function createDiscoveryStepBuilder<
  FacadeGameState extends object,
  TCommandInput extends Record<string, unknown>,
  TStepId extends string,
  TSteps extends readonly DiscoveryStepDefinition[] =
    readonly DiscoveryStepDefinition[],
>(
  stepId: TStepId,
): DiscoveryStepBuilder<FacadeGameState, TCommandInput, TSteps, TStepId> {
  const stepState: DiscoveryStepAccumulator = {
    stepId,
    initial: false,
  };

  function createResolvedBuilder<
    TInput extends Record<string, unknown>,
    TOutput extends Record<string, unknown>,
    TInitial extends boolean,
  >(): DiscoveryStepResolvedBuilder<
    FacadeGameState,
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
          FacadeGameState,
          TStepId,
          TInput,
          TOutput,
          TInitial,
          DiscoveryStepResolveFn<
            FacadeGameState,
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
    FacadeGameState,
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
    FacadeGameState,
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
    FacadeGameState,
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
    FacadeGameState,
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

export function createCommandFactory<FacadeGameState extends object>() {
  function brandCommandDefinition<
    TCommandInput extends Record<string, unknown>,
  >(
    definition:
      | NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>
      | DiscoverableCommandConfig<FacadeGameState, TCommandInput>,
  ): DefinedCommand<FacadeGameState, TCommandInput> {
    return Object.defineProperty(definition, brand, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    }) as DefinedCommand<FacadeGameState, TCommandInput>;
  }

  function finalizeDiscoveryDefinition(
    steps: readonly DiscoveryStepDefinition<
      FacadeGameState,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
      boolean,
      (
        context: DiscoveryStepContext<FacadeGameState, Record<string, unknown>>,
      ) => unknown
    >[],
  ): DiscoveryDefinition {
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
    } as DiscoveryDefinition;
  }

  function createBuilder<
    TCommandInput extends Record<string, unknown>,
    TDiscoveryInput extends Record<string, unknown> = TCommandInput,
    THasDiscovery extends boolean = false,
    THasAvailability extends boolean = false,
    THasValidate extends boolean = false,
    THasExecute extends boolean = false,
  >(
    accumulator: CommandBuilderAccumulator<
      FacadeGameState,
      TCommandInput,
      TDiscoveryInput,
      THasDiscovery
    >,
  ): CommandBuilder<
    FacadeGameState,
    TCommandInput,
    TDiscoveryInput,
    THasDiscovery,
    THasAvailability,
    THasValidate,
    THasExecute
  > {
    return {
      discoverable<
        TSteps extends readonly [
          DiscoveryStepDefinition,
          ...DiscoveryStepDefinition[],
        ],
      >(
        configure: (
          step: <TStepId extends string>(
            stepId: TStepId,
          ) => DiscoveryStepBuilder<
            FacadeGameState,
            TCommandInput,
            TSteps,
            TStepId
          >,
        ) => TSteps,
      ) {
        function discoveryStepFactory<TStepId extends string>(stepId: TStepId) {
          return createDiscoveryStepBuilder<
            FacadeGameState,
            TCommandInput,
            TStepId,
            TSteps
          >(stepId);
        }

        const steps = configure(discoveryStepFactory);
        const discovery = finalizeDiscoveryDefinition(
          steps as readonly DiscoveryStepDefinition<
            FacadeGameState,
            string,
            Record<string, unknown>,
            Record<string, unknown>,
            boolean,
            (
              context: DiscoveryStepContext<
                FacadeGameState,
                Record<string, unknown>
              >,
            ) => unknown
          >[],
        );

        const nextAccumulator = {
          ...accumulator,
          discovery,
        } as DiscoverableCommandAccumulator<
          FacadeGameState,
          TCommandInput,
          TDiscoveryInput
        >;

        return createBuilder<
          TCommandInput,
          TDiscoveryInput,
          true,
          THasAvailability,
          THasValidate,
          THasExecute
        >(nextAccumulator);
      },

      isAvailable(isAvailable) {
        const nextAccumulator = {
          ...accumulator,
          isAvailable,
        } as CommandBuilderAccumulator<
          FacadeGameState,
          TCommandInput,
          TDiscoveryInput,
          THasDiscovery
        >;

        return createBuilder<
          TCommandInput,
          TDiscoveryInput,
          THasDiscovery,
          true,
          THasValidate,
          THasExecute
        >(nextAccumulator);
      },

      validate(validate) {
        const nextAccumulator = {
          ...accumulator,
          validate,
        } as CommandBuilderAccumulator<
          FacadeGameState,
          TCommandInput,
          TDiscoveryInput,
          THasDiscovery
        >;

        return createBuilder<
          TCommandInput,
          TDiscoveryInput,
          THasDiscovery,
          THasAvailability,
          true,
          THasExecute
        >(nextAccumulator);
      },

      execute(execute) {
        const nextAccumulator = {
          ...accumulator,
          execute,
        } as CommandBuilderAccumulator<
          FacadeGameState,
          TCommandInput,
          TDiscoveryInput,
          THasDiscovery
        >;

        return createBuilder<
          TCommandInput,
          TDiscoveryInput,
          THasDiscovery,
          THasAvailability,
          THasValidate,
          true
        >(nextAccumulator);
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
          | NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>
          | DiscoverableCommandConfig<FacadeGameState, TCommandInput>);
      },
    } as CommandBuilder<
      FacadeGameState,
      TCommandInput,
      TDiscoveryInput,
      THasDiscovery,
      THasAvailability,
      THasValidate,
      THasExecute
    >;
  }

  function defineCommand<TCommandInput extends Record<string, unknown>>(
    config: CommandBuilderBaseConfig<TCommandInput>,
  ): CommandBuilder<FacadeGameState, TCommandInput> {
    assertSerializableSchema(config.commandSchema);

    return createBuilder({
      commandId: config.commandId,
      commandSchema: config.commandSchema,
    } satisfies NonDiscoverableCommandAccumulator<
      FacadeGameState,
      TCommandInput
    >);
  }

  return defineCommand;
}
