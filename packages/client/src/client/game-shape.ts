import type {
  AnyGameExecutor,
  CommandDiscoveryResultFor,
  DiscoveryDefinition,
  DomainEventsOf,
  EventRegistry,
  GameExecutor,
  RuntimeEvent,
} from "@tableverse-kit/engine";

export type { AnyGameExecutor };

/** The command-definition union carried by the executor's 3rd type param. */
type CommandDefsOf<E> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E extends GameExecutor<any, any, infer Cmd, any> ? Cmd : never;

export type SetupInputOf<E> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E extends GameExecutor<any, infer Setup, any, any> ? Setup : never;

/**
 * Correlated command payload: distributes over the command union so
 * `command.type` narrows `command.input` to that command's schema.
 */
export type CommandFor<Cmd> = Cmd extends {
  commandId: infer Id extends string;
  commandSchema: { static: infer In };
}
  ? { type: Id; input: In }
  : never;

type StepPayload<Id extends string, Step> = Step extends {
  stepId: infer S extends string;
  inputSchema: { static: infer In };
}
  ? { type: Id; step: S; input: In }
  : never;

/**
 * Correlated discovery request: one member per command × discovery step, each
 * carrying that step's input schema. Non-discoverable commands drop out.
 */
export type DiscoveryPayloadFor<Cmd> = Cmd extends {
  commandId: infer Id extends string;
  discovery: DiscoveryDefinition<infer TSteps>;
}
  ? StepPayload<Id, TSteps[number]>
  : never;

/** The game's domain-event union plus the engine's runtime events. */
export type EventsOf<E> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E extends GameExecutor<any, any, any, infer Reg extends EventRegistry>
    ? DomainEventsOf<Reg> | RuntimeEvent
    : never;

/** Every client-facing shape derived from the executor type. */
export type GameShapeOf<E extends AnyGameExecutor> = {
  view: ReturnType<E["getView"]>;
  command: CommandFor<CommandDefsOf<E>>;
  discovery: {
    payload: DiscoveryPayloadFor<CommandDefsOf<E>>;
    result: CommandDiscoveryResultFor<CommandDefsOf<E>> | null;
  };
  event: EventsOf<E>;
};
