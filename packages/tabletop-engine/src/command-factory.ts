import type {
  CommandSchema,
  DefinedCommand,
  DiscoverableCommandConfig,
  NonDiscoverableCommandConfig,
} from "./types/command";
import { commandDefinitionBrand as brand } from "./types/command";

export interface CommandFactory<FacadeGameState extends object> {
  <TCommandInput extends Record<string, unknown>>(
    config: NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>,
  ): DefinedCommand<FacadeGameState, TCommandInput>;
  <
    TCommandInput extends Record<string, unknown>,
    TDiscoveryInput extends Record<string, unknown>,
  >(
    config: DiscoverableCommandConfig<
      FacadeGameState,
      TCommandInput,
      TDiscoveryInput
    >,
  ): DefinedCommand<FacadeGameState, TCommandInput, TDiscoveryInput>;
}

export function createCommandFactory<FacadeGameState extends object>() {
  function defineCommand<TCommandInput extends Record<string, unknown>>(
    config: NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>,
  ): DefinedCommand<FacadeGameState, TCommandInput>;
  function defineCommand<
    TCommandInput extends Record<string, unknown>,
    TDiscoveryInput extends Record<string, unknown>,
  >(
    config: DiscoverableCommandConfig<
      FacadeGameState,
      TCommandInput,
      TDiscoveryInput
    >,
  ): DefinedCommand<FacadeGameState, TCommandInput, TDiscoveryInput>;
  function defineCommand<
    TCommandInput extends Record<string, unknown>,
    TDiscoveryInput extends Record<string, unknown>,
  >(
    config:
      | NonDiscoverableCommandConfig<FacadeGameState, TCommandInput>
      | DiscoverableCommandConfig<
          FacadeGameState,
          TCommandInput,
          TDiscoveryInput
        >,
  ): DefinedCommand<FacadeGameState, TCommandInput, TDiscoveryInput> {
    return Object.defineProperty(config, brand, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    }) as DefinedCommand<FacadeGameState, TCommandInput, TDiscoveryInput>;
  }

  return defineCommand as CommandFactory<FacadeGameState>;
}

export type InferCommandInputFromSchema<
  TSchema extends CommandSchema<Record<string, unknown>>,
> = TSchema["static"];
