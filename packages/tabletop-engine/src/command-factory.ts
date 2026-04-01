import type {
  CommandPayloadSchema,
  DefinedCommand,
  DiscoverableCommandConfig,
  NonDiscoverableCommandConfig,
} from "./types/command";
import { commandDefinitionBrand as brand } from "./types/command";

export interface CommandFactory<FacadeGameState extends object> {
  <TPayload extends Record<string, unknown>>(
    config: NonDiscoverableCommandConfig<FacadeGameState, TPayload>,
  ): DefinedCommand<FacadeGameState, TPayload>;
  <
    TPayload extends Record<string, unknown>,
    TDraft extends Record<string, unknown>,
  >(
    config: DiscoverableCommandConfig<FacadeGameState, TPayload, TDraft>,
  ): DefinedCommand<FacadeGameState, TPayload, TDraft>;
}

export function createCommandFactory<FacadeGameState extends object>() {
  function defineCommand<TPayload extends Record<string, unknown>>(
    config: NonDiscoverableCommandConfig<FacadeGameState, TPayload>,
  ): DefinedCommand<FacadeGameState, TPayload>;
  function defineCommand<
    TPayload extends Record<string, unknown>,
    TDraft extends Record<string, unknown>,
  >(
    config: DiscoverableCommandConfig<FacadeGameState, TPayload, TDraft>,
  ): DefinedCommand<FacadeGameState, TPayload, TDraft>;
  function defineCommand<
    TPayload extends Record<string, unknown>,
    TDraft extends Record<string, unknown>,
  >(
    config:
      | NonDiscoverableCommandConfig<FacadeGameState, TPayload>
      | DiscoverableCommandConfig<FacadeGameState, TPayload, TDraft>,
  ): DefinedCommand<FacadeGameState, TPayload, TDraft> {
    return Object.defineProperty(config, brand, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    }) as DefinedCommand<FacadeGameState, TPayload, TDraft>;
  }

  return defineCommand as CommandFactory<FacadeGameState>;
}

export type InferPayloadFromSchema<
  TSchema extends CommandPayloadSchema<Record<string, unknown>>,
> = TSchema["static"];
