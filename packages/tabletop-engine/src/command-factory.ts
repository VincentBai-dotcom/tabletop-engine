import type {
  CommandDefinition,
  CommandPayloadSchema,
  DiscoverableCommandDefinition,
  NonDiscoverableCommandDefinition,
} from "./types/command";

export function createCommandFactory<FacadeGameState extends object>() {
  function defineCommand<TPayload extends Record<string, unknown>>(
    config: NonDiscoverableCommandDefinition<FacadeGameState, TPayload>,
  ): CommandDefinition<FacadeGameState, TPayload>;
  function defineCommand<
    TPayload extends Record<string, unknown>,
    TDraft extends Record<string, unknown>,
  >(
    config: DiscoverableCommandDefinition<FacadeGameState, TPayload, TDraft>,
  ): CommandDefinition<FacadeGameState, TPayload, TDraft>;
  function defineCommand<
    TPayload extends Record<string, unknown>,
    TDraft extends Record<string, unknown>,
  >(
    config:
      | NonDiscoverableCommandDefinition<FacadeGameState, TPayload>
      | DiscoverableCommandDefinition<FacadeGameState, TPayload, TDraft>,
  ): CommandDefinition<FacadeGameState, TPayload, TDraft> {
    return config as CommandDefinition<FacadeGameState, TPayload, TDraft>;
  }

  return defineCommand;
}

export type InferPayloadFromSchema<
  TSchema extends CommandPayloadSchema<Record<string, unknown>>,
> = TSchema["static"];
