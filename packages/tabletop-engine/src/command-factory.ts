import type {
  CommandBuilderAccumulator,
  CommandBuilder,
  CommandBuilderBaseConfig,
  CommandSchema,
  DefinedCommand,
  DiscoverableCommandAccumulator,
  DiscoverableCommandBuilderConfig,
  NonDiscoverableCommandAccumulator,
  DiscoverableCommandConfig,
  NonDiscoverableCommandConfig,
} from "./types/command";
import { commandDefinitionBrand as brand } from "./types/command";
import { assertSerializableSchema } from "./schema";

export interface CommandFactory<FacadeGameState extends object> {
  <TCommandInput extends Record<string, unknown>>(
    config: CommandBuilderBaseConfig<TCommandInput>,
  ): CommandBuilder<FacadeGameState, TCommandInput>;
}

export function createCommandFactory<FacadeGameState extends object>() {
  function brandCommandDefinition<
    TCommandInput extends Record<string, unknown>,
  >(
    definition: NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>,
  ): DefinedCommand<FacadeGameState, TCommandInput>;
  function brandCommandDefinition<
    TCommandInput extends Record<string, unknown>,
    TDiscoveryInput extends Record<string, unknown>,
  >(
    definition: DiscoverableCommandConfig<
      FacadeGameState,
      TCommandInput,
      TDiscoveryInput
    >,
  ): DefinedCommand<FacadeGameState, TCommandInput, TDiscoveryInput>;
  function brandCommandDefinition<
    TCommandInput extends Record<string, unknown>,
    TDiscoveryInput extends Record<string, unknown>,
  >(
    definition:
      | NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>
      | DiscoverableCommandConfig<
          FacadeGameState,
          TCommandInput,
          TDiscoveryInput
        >,
  ) {
    return Object.defineProperty(definition, brand, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
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
      discoverable<TNextDiscoveryInput extends Record<string, unknown>>(
        config: DiscoverableCommandBuilderConfig<
          FacadeGameState,
          TCommandInput,
          TNextDiscoveryInput
        >,
      ) {
        assertSerializableSchema(config.discoverySchema);

        return createBuilder<
          TCommandInput,
          TNextDiscoveryInput,
          true,
          THasAvailability,
          THasValidate,
          THasExecute
        >({
          ...accumulator,
          discoverySchema: config.discoverySchema,
          discover: config.discover,
        } satisfies DiscoverableCommandAccumulator<
          FacadeGameState,
          TCommandInput,
          TNextDiscoveryInput
        >);
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

        const validate = accumulator.validate;
        const execute = accumulator.execute;

        if ("discoverySchema" in accumulator && "discover" in accumulator) {
          return brandCommandDefinition({
            ...accumulator,
            validate,
            execute,
          } satisfies DiscoverableCommandConfig<
            FacadeGameState,
            TCommandInput,
            TDiscoveryInput
          >);
        }

        return brandCommandDefinition({
          ...accumulator,
          validate,
          execute,
        } satisfies NonDiscoverableCommandConfig<
          FacadeGameState,
          TCommandInput
        >);
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
