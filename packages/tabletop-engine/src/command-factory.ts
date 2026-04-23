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
  resolve?: DiscoveryStepDefinition<
    object,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>
  >["resolve"];
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
    });
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
      } satisfies DiscoveryStepDefinition<
        FacadeGameState,
        Record<string, unknown>,
        Record<string, unknown>,
        TCommandInput
      >;
    });

    return {
      startStep: steps[0]!.stepId,
      steps,
    } satisfies DiscoveryDefinition<FacadeGameState, TCommandInput>;
  }

  function createDiscoveryStepBuilder<
    TCommandInput extends Record<string, unknown>,
  >(
    stepState: DiscoveryStepAccumulator,
  ): DiscoveryStepBuilder<
    FacadeGameState,
    Record<string, unknown>,
    Record<string, unknown>,
    TCommandInput
  > {
    const builder: Partial<
      DiscoveryStepBuilder<
        FacadeGameState,
        Record<string, unknown>,
        Record<string, unknown>,
        TCommandInput
      >
    > = {};

    builder.input = (schema) => {
      assertSerializableSchema(schema);
      stepState.inputSchema = schema;
      return builder as DiscoveryStepBuilder<
        FacadeGameState,
        typeof schema.static,
        Record<string, unknown>,
        TCommandInput
      >;
    };

    builder.output = (schema) => {
      assertSerializableSchema(schema);
      stepState.outputSchema = schema;
      return builder as DiscoveryStepBuilder<
        FacadeGameState,
        Record<string, unknown>,
        typeof schema.static,
        TCommandInput
      >;
    };

    builder.resolve = (resolve) => {
      stepState.resolve = resolve as DiscoveryStepDefinition<
        FacadeGameState,
        Record<string, unknown>,
        Record<string, unknown>,
        TCommandInput
      >["resolve"];
    };

    return builder as DiscoveryStepBuilder<
      FacadeGameState,
      Record<string, unknown>,
      Record<string, unknown>,
      TCommandInput
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
      configure(createDiscoveryStepBuilder<TCommandInput>(stepState));
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
        } satisfies DiscoverableCommandAccumulator<
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
        } satisfies CommandBuilderAccumulator<
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
        } satisfies CommandBuilderAccumulator<
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
        } satisfies CommandBuilderAccumulator<
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
