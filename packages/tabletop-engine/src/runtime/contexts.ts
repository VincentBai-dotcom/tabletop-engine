import type {
  Command,
  Discovery,
  InternalCommandAvailabilityContext,
  InternalDiscoveryContext,
  InternalExecuteContext,
  InternalValidationContext,
} from "../types/command";
import type { GameEvent } from "../types/event";
import type { CanonicalState, RuntimeState } from "../types/state";
import type { RNGApi } from "../types/rng";

export function createValidationContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TCommandInput extends Command,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: Readonly<FacadeGameState>,
  command: TCommandInput,
): InternalValidationContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TCommandInput
> {
  return {
    state,
    game,
    runtime: state.runtime,
    command,
  };
}

export function createCommandAvailabilityContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: Readonly<FacadeGameState>,
  commandType: string,
  actorId?: string,
): InternalCommandAvailabilityContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime
> {
  return {
    state,
    game,
    runtime: state.runtime,
    commandType,
    actorId,
  };
}

export function createDiscoveryContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TDiscoveryInput extends Record<string, unknown>,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: Readonly<FacadeGameState>,
  discovery: Discovery<TDiscoveryInput>,
): InternalDiscoveryContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TDiscoveryInput
> {
  return {
    ...createCommandAvailabilityContext(
      state,
      game,
      discovery.type,
      discovery.actorId,
    ),
    discovery,
  };
}

export function createExecuteContext<
  CanonicalGameState extends object,
  FacadeGameState extends object,
  Runtime extends RuntimeState,
  TCommandInput extends Command,
>(
  state: CanonicalState<CanonicalGameState, Runtime>,
  game: FacadeGameState,
  command: TCommandInput,
  rng: RNGApi,
  emitEvent: (event: GameEvent) => void,
): InternalExecuteContext<
  CanonicalGameState,
  FacadeGameState,
  Runtime,
  TCommandInput
> {
  return {
    state,
    command,
    game,
    runtime: state.runtime,
    rng,
    emitEvent,
  };
}
