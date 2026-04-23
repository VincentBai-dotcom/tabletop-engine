import type {
  CommandBuilder,
  CommandBuilderAccumulator,
  CommandBuilderBaseConfig,
  CommandSchema,
  DefinedCommand,
  DiscoverableCommandAccumulator,
  DiscoverableCommandConfig,
  DiscoveryDefinition,
  DiscoveryFlowBuilder,
  DiscoveryStepBuilder,
  DiscoveryStepDefinition,
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
  inputSchema?: CommandSchema<Record<string, unknown>>;
  outputSchema?: CommandSchema<Record<string, unknown>>;
  resolve?: (...args: unknown[]) => unknown;
};

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

  function finalizeDiscoveryDefinition<
    TCommandInput extends Record<string, unknown>,
  >(
    stepStates: DiscoveryStepAccumulator[],
  ): DiscoveryDefinition<FacadeGameState, TCommandInput> {
    if (stepStates.length === 0) {
      throw new Error("command_builder_missing_discovery_step");
    }

    const seenStepIds = new Set<string>();

    const steps = stepStates.map((stepState, index) => {
      if (seenStepIds.has(stepState.stepId)) {
        throw new Error(`duplicate_discovery_step_id:${stepState.stepId}`);
      }
      seenStepIds.add(stepState.stepId);

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
        stepId: stepState.stepId,
        inputSchema: stepState.inputSchema,
        outputSchema: stepState.outputSchema,
        defaultNextStep: stepStates[index + 1]?.stepId,
        resolve: stepState.resolve,
      } as DiscoveryStepDefinition<
        FacadeGameState,
        Record<string, unknown>,
        Record<string, unknown>,
        TCommandInput
      >;
    }) as DiscoveryStepDefinition<
      FacadeGameState,
      Record<string, unknown>,
      Record<string, unknown>,
      TCommandInput
    >[];

    return {
      startStep: steps[0]!.stepId,
      steps,
    } as DiscoveryDefinition<FacadeGameState, TCommandInput>;
  }

  function createDiscoveryStepBuilder<
    TCommandInput extends Record<string, unknown>,
    TInput extends Record<string, unknown> = Record<string, unknown>,
    TOutput extends Record<string, unknown> = Record<string, unknown>,
    THasInput extends boolean = false,
    THasOutput extends boolean = false,
  >(
    stepState: DiscoveryStepAccumulator,
  ): DiscoveryStepBuilder<
    FacadeGameState,
    TInput,
    TOutput,
    TCommandInput,
    THasInput,
    THasOutput
  > {
    const builder: Partial<
      DiscoveryStepBuilder<
        FacadeGameState,
        TInput,
        TOutput,
        TCommandInput,
        true,
        true
      >
    > = {};

    const input: DiscoveryStepBuilder<
      FacadeGameState,
      TInput,
      TOutput,
      TCommandInput
    >["input"] = <TNextInput extends Record<string, unknown>>(
      schema: CommandSchema<TNextInput>,
    ) => {
      assertSerializableSchema(schema);
      stepState.inputSchema = schema;
      return builder as DiscoveryStepBuilder<
        FacadeGameState,
        typeof schema.static,
        TOutput,
        TCommandInput,
        true,
        THasOutput
      >;
    };
    builder.input = input;

    const output: DiscoveryStepBuilder<
      FacadeGameState,
      TInput,
      TOutput,
      TCommandInput
    >["output"] = <TNextOutput extends Record<string, unknown>>(
      schema: CommandSchema<TNextOutput>,
    ) => {
      assertSerializableSchema(schema);
      stepState.outputSchema = schema;
      return builder as DiscoveryStepBuilder<
        FacadeGameState,
        TInput,
        typeof schema.static,
        TCommandInput,
        THasInput,
        true
      >;
    };
    builder.output = output;

    builder.resolve = (resolve) => {
      stepState.resolve = resolve as (...args: unknown[]) => unknown;
    };

    return builder as DiscoveryStepBuilder<
      FacadeGameState,
      TInput,
      TOutput,
      TCommandInput,
      THasInput,
      THasOutput
    >;
  }

  function createDiscoveryFlowBuilder<
    TCommandInput extends Record<string, unknown>,
  >(
    stepStates: DiscoveryStepAccumulator[],
  ): DiscoveryFlowBuilder<FacadeGameState, TCommandInput> {
    const flow: Partial<DiscoveryFlowBuilder<FacadeGameState, TCommandInput>> =
      {};

    flow.step = (stepId, configure) => {
      const stepState: DiscoveryStepAccumulator = {
        stepId,
      };
      stepStates.push(stepState);
      configure(
        createDiscoveryStepBuilder<
          TCommandInput,
          Record<string, unknown>,
          Record<string, unknown>
        >(stepState),
      );
      return flow as DiscoveryFlowBuilder<FacadeGameState, TCommandInput>;
    };

    return flow as DiscoveryFlowBuilder<FacadeGameState, TCommandInput>;
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
      discoverable(configure) {
        const stepStates: DiscoveryStepAccumulator[] = [];
        const flow = createDiscoveryFlowBuilder<TCommandInput>(stepStates);
        configure(flow);

        const discovery =
          finalizeDiscoveryDefinition<TCommandInput>(stepStates);

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

  return defineCommand as CommandFactory<FacadeGameState>;
}

export type InferCommandInputFromSchema<
  TSchema extends CommandSchema<Record<string, unknown>>,
> = TSchema["static"];
