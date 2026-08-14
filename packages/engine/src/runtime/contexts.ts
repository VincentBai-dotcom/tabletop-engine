import type {
  Command,
  CommandAvailabilityContext,
  Discovery,
  DiscoveryStepContext,
  ExecuteContext,
  ValidationContext,
} from "../types/command";
import type { EmittableEvent } from "../types/event";
import type { CanonicalState } from "../types/state";
import type { RNGApi } from "../types/rng";

export function createValidationContext<
  CanonicalGameState extends object,
  HydratedState extends object,
  TCommandInput extends Command,
>(
  state: CanonicalState<CanonicalGameState>,
  game: Readonly<HydratedState>,
  command: TCommandInput,
): ValidationContext<HydratedState, TCommandInput> {
  return {
    game,
    runtime: state.runtime,
    command,
  };
}

export function createCommandAvailabilityContext<
  CanonicalGameState extends object,
  HydratedState extends object,
>(
  state: CanonicalState<CanonicalGameState>,
  game: Readonly<HydratedState>,
  commandType: string,
  actorId: string,
): CommandAvailabilityContext<HydratedState> {
  return {
    game,
    runtime: state.runtime,
    commandType,
    actorId,
  };
}

export function createDiscoveryContext<
  CanonicalGameState extends object,
  HydratedState extends object,
  TDiscoveryInput extends Record<string, unknown>,
>(
  state: CanonicalState<CanonicalGameState>,
  game: Readonly<HydratedState>,
  discovery: Discovery<TDiscoveryInput>,
): DiscoveryStepContext<HydratedState, TDiscoveryInput> {
  return {
    ...createCommandAvailabilityContext(
      state,
      game,
      discovery.type,
      discovery.actorId,
    ),
    discovery,
    input: discovery.input,
  };
}

export function createExecuteContext<
  CanonicalGameState extends object,
  HydratedState extends object,
  TCommandInput extends Command,
>(
  state: CanonicalState<CanonicalGameState>,
  game: HydratedState,
  command: TCommandInput,
  rng: RNGApi,
  emitEvent: (event: EmittableEvent) => void,
): ExecuteContext<HydratedState, TCommandInput> & {
  emitEvent(event: EmittableEvent): void;
} {
  return {
    command,
    game,
    runtime: state.runtime,
    rng,
    emitEvent,
  };
}
