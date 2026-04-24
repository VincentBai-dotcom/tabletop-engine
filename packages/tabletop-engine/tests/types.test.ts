import { expect, test } from "bun:test";
// @ts-expect-error legacy canonical helper types should be removed from the public API
import type { CanonicalGameStateOf as RemovedCanonicalGameStateOf } from "../src/index";
// @ts-expect-error legacy canonical helper types should be removed from the public API
import type { CanonicalStateOf as RemovedCanonicalStateOf } from "../src/index";
import type {
  CommandAvailabilityContext,
  Command,
  CommandDiscoveryResult,
  CanonicalState,
  Discovery,
  DiscoveryContext,
  ExecutionResult,
  GameEvent,
  ValidationOutcome,
} from "../src/index";
import {
  configureVisibility,
  createGameExecutor,
  createCommandFactory,
  createStageFactory,
  field,
  State,
  t,
} from "../src/index";
import type {
  CommandFromSchema,
  InternalCommandDefinition,
  InternalExecuteContext,
} from "../src/types/command";
import type {
  MultiActivePlayerStageDefinition,
  SingleActivePlayerStageDefinition,
} from "../src/types/progression";
import type { RuntimeState } from "../src/types/state";
import { GameDefinitionBuilder } from "../src/game-definition";
void (0 as unknown as RemovedCanonicalGameStateOf<never>);
void (0 as unknown as RemovedCanonicalStateOf<never>);

type DiscoveryStepFactory = typeof import("../src/index") extends {
  discoveryStep: infer TFactory;
}
  ? TFactory
  : never;

@State()
class TypedCounterChildState {
  @field(t.number())
  value = 0;
}

@State()
class TypedCounterRootState {
  @field(t.state(() => TypedCounterChildState))
  counter!: TypedCounterChildState;

  increment() {
    this.counter.value += 1;
  }
}

const typedHiddenSchema = t.object({
  count: t.number(),
  health: t.number(),
});

@State()
class TypedVisibilityState {
  @field(t.string())
  id = "";

  @field(t.number())
  health = 0;

  @field(t.array(t.number()))
  hand: number[] = [];

  getLabel() {
    return `${this.id}:${this.health}`;
  }
}

configureVisibility(TypedVisibilityState, ({ field }) => ({
  ownedBy: field.id,
  fields: [
    field.hand.visibleToSelf({
      schema: typedHiddenSchema,
      derive(hand, state) {
        const typedHand: number[] = hand;
        const typedHealth: number = state.health;
        const typedLabel: string = state.getLabel();

        expect(typedHand).toBeArray();
        expect(typedHealth).toBeNumber();
        expect(typedLabel).toBeString();

        return {
          count: hand.length,
          health: state.health,
        };
      },
    }),
  ],
}));

@State()
class InvalidTypedVisibilityState {
  @field(t.string())
  id = "";

  @field(t.array(t.number()))
  hand: number[] = [];
}

configureVisibility(InvalidTypedVisibilityState, ({ field }) => ({
  ownedBy: field.id,
  fields: [
    field.hand.visibleToSelf({
      schema: t.object({
        count: t.number(),
      }),
      // @ts-expect-error derive must return the static type of the visibility schema
      derive(hand) {
        return {
          wrong: hand.length,
        };
      },
    }),
  ],
}));

test("foundational runtime types compose", () => {
  const event: GameEvent = {
    category: "domain",
    type: "card_drawn",
    payload: { playerId: "p1", count: 1 },
  };

  const state: CanonicalState = {
    game: {},
    runtime: {
      progression: {
        currentStage: {
          id: "gameEnd",
          kind: "automatic",
        },
        lastActingStage: null,
      },
      rng: {
        seed: "seed",
        cursor: 0,
      },
      history: {
        entries: [],
      },
    },
  };

  const command: Command = {
    type: "draw_card",
    actorId: "p1",
    input: { count: 1 },
  };

  const result: ExecutionResult = {
    ok: true,
    state,
    events: [event],
  };

  const validation: ValidationOutcome = {
    ok: false,
    reason: "wrong_phase",
    metadata: { expectedPhase: "main" },
  };

  expect(event.category).toBe("domain");
  expect(state.runtime.progression.currentStage.kind).toBe("automatic");
  expect(command.type).toBe("draw_card");
  expect(result.ok).toBeTrue();
  expect(result.state).toBe(state);
  expect(validation.ok).toBeFalse();
});

test("stage machine types support single-active and automatic stage authoring", () => {
  const defineStage = createStageFactory<{ score: number }>();
  const defineCommand = createCommandFactory<{ score: number }>();
  const gameEndStage = defineStage("gameEnd").automatic().build();
  const drawCardCommand = defineCommand({
    commandId: "draw_card",
    commandSchema: t.object({
      count: t.number(),
    }),
  })
    .validate(() => ({ ok: true as const }))
    .execute(() => {})
    .build();

  const playerTurnStage = createPlayerTurnStage();

  function createPlayerTurnStage(): SingleActivePlayerStageDefinition<{
    score: number;
  }> {
    return defineStage("playerTurn")
      .singleActivePlayer()
      .activePlayer(({ runtime }) => {
        const currentStage = runtime.progression.currentStage;

        if (currentStage.kind === "activePlayer") {
          return currentStage.activePlayerId;
        }

        return "player-1";
      })
      .commands([drawCardCommand])
      .nextStages(() => ({
        playerTurnStage,
        gameEndStage,
      }))
      .transition(({ nextStages, command }) => {
        expect(command.actorId).toBe("player-1");
        expect(command.input.count).toBeNumber();
        return command.type === "end_game"
          ? nextStages.gameEndStage
          : nextStages.playerTurnStage;
      })
      .build();
  }

  const currentStage:
    | {
        id: string;
        kind: "activePlayer";
        activePlayerId: string;
      }
    | {
        id: string;
        kind: "automatic";
      } = {
    id: "playerTurn",
    kind: "activePlayer",
    activePlayerId: "player-1",
  };

  expect(playerTurnStage.id).toBe("playerTurn");
  expect(currentStage.kind).toBe("activePlayer");
  if (currentStage.kind === "activePlayer") {
    expect(currentStage.activePlayerId).toBe("player-1");
  }
  expect(gameEndStage.id).toBe("gameEnd");
});

test("stage machine types support multi-active stage authoring", () => {
  const defineStage = createStageFactory<{ actions: string[] }>();
  const defineCommand = createCommandFactory<{ actions: string[] }>();
  const gameEndStage = defineStage("gameEnd").automatic().build();
  const submitCommand = defineCommand({
    commandId: "submit",
    commandSchema: t.object({
      value: t.string(),
    }),
  })
    .validate(() => ({ ok: true as const }))
    .execute(({ game, command }) => {
      game.actions.push(command.input.value);
    })
    .build();

  const stage = createMultiActiveStage();

  function createMultiActiveStage(): MultiActivePlayerStageDefinition<
    { actions: string[] },
    RuntimeState,
    {
      submittedByPlayerId: Record<string, string>;
    }
  > {
    return defineStage("simultaneousTurn")
      .multiActivePlayer()
      .memory(
        t.object({
          submittedByPlayerId: t.record(t.string(), t.string()),
        }),
        () => ({
          submittedByPlayerId: {} as Record<string, string>,
        }),
      )
      .activePlayers(({ memory }) => {
        return ["p1", "p2"].filter((playerId) => {
          return memory.submittedByPlayerId[playerId] === undefined;
        });
      })
      .commands([submitCommand])
      .onSubmit(({ command, execute, memory }) => {
        memory.submittedByPlayerId[command.actorId] = command.input.value;
        execute(command);
      })
      .isComplete(({ memory }) => {
        return Object.keys(memory.submittedByPlayerId).length === 2;
      })
      .nextStages(() => ({
        gameEndStage,
      }))
      .transition(({ nextStages, memory }) => {
        expect(memory.submittedByPlayerId.p1).toBeDefined();
        return nextStages.gameEndStage;
      })
      .build();
  }

  const currentStage:
    | {
        id: string;
        kind: "activePlayer";
        activePlayerId: string;
      }
    | {
        id: string;
        kind: "automatic";
      }
    | {
        id: string;
        kind: "multiActivePlayer";
        activePlayerIds: string[];
        memory: {
          submittedByPlayerId: Record<string, string>;
        };
      } = {
    id: "simultaneousTurn",
    kind: "multiActivePlayer",
    activePlayerIds: ["p1", "p2"],
    memory: {
      submittedByPlayerId: {},
    },
  };

  const baseBuilder = defineStage("draft").multiActivePlayer();

  // @ts-expect-error build should not exist before multi-active stage requirements are set
  void baseBuilder.build;

  const memoryBuilder = baseBuilder.memory(
    t.object({
      submittedByPlayerId: t.record(t.string(), t.string()),
    }),
    () => ({
      submittedByPlayerId: {} as Record<string, string>,
    }),
  );

  // @ts-expect-error build should not exist before activePlayers, commands, onSubmit, isComplete, nextStages, and transition are set
  void memoryBuilder.build;

  expect(stage.id).toBe("simultaneousTurn");
  expect(currentStage.kind).toBe("multiActivePlayer");
  if (currentStage.kind === "multiActivePlayer") {
    expect(currentStage.activePlayerIds).toEqual(["p1", "p2"]);
    expect(currentStage.memory.submittedByPlayerId).toEqual({});
  }
  expect(gameEndStage.id).toBe("gameEnd");
});

test("discovery types compose for step-authored options and completion", () => {
  type PlayCardDiscoveryInput = {
    step: string;
    cardId?: number;
    targets?: number[];
  };

  type PlayCardInput = {
    cardId: number;
    targets?: number[];
  };

  const availabilityContext: CommandAvailabilityContext<{
    handCount: number;
  }> = {
    game: { handCount: 3 },
    runtime: {
      progression: {
        currentStage: {
          id: "turn",
          kind: "activePlayer",
          activePlayerId: "p1",
        },
        lastActingStage: {
          id: "turn",
          kind: "activePlayer",
          activePlayerId: "p1",
        },
      },
      rng: { seed: "seed", cursor: 0 },
      history: { entries: [] },
    },
    commandType: "play_card",
    actorId: "p1",
  };

  const discoveryRequest: Discovery<PlayCardDiscoveryInput> = {
    type: "play_card",
    actorId: "p1",
    step: "select_target",
    input: {
      step: "select_target",
      cardId: 12,
    },
  };

  const discoveryContext: DiscoveryContext<
    { handCount: number },
    PlayCardDiscoveryInput
  > = {
    ...availabilityContext,
    discovery: discoveryRequest,
  };

  const discoveryResult: CommandDiscoveryResult<
    "select_target",
    PlayCardDiscoveryInput,
    {
      label: string;
      targetId: number;
    },
    PlayCardInput
  > = {
    complete: false,
    step: "select_target",
    options: [
      {
        id: "target-1",
        output: {
          label: "Target 1",
          targetId: 101,
        },
        nextInput: {
          step: "complete",
          cardId: 12,
          targets: [101],
        },
        nextStep: "complete",
      },
    ],
  };

  const completion: CommandDiscoveryResult<
    "complete",
    PlayCardDiscoveryInput,
    {
      label: string;
      targetId: number;
    },
    PlayCardInput
  > = {
    complete: true,
    input: {
      cardId: 12,
      targets: [101],
    },
  };

  expect(availabilityContext.actorId).toBe("p1");
  expect(discoveryContext.discovery.step).toBe("select_target");
  expect(discoveryContext.discovery.input).toEqual({
    step: "select_target",
    cardId: 12,
  });
  expect(discoveryResult.step).toBe("select_target");
  expect(discoveryResult.options[0]?.id).toBe("target-1");
  if (!discoveryResult.complete) {
    expect(discoveryResult.options[0]?.nextInput).toEqual({
      step: "complete",
      cardId: 12,
      targets: [101],
    });
  }
  if (completion.complete) {
    expect(completion.input).toEqual({
      cardId: 12,
      targets: [101],
    });
  }
});

test("strict command and discovery requests require actorId and input", () => {
  const command: Command<{ amount: number }> = {
    type: "gain_score",
    actorId: "p1",
    input: { amount: 2 },
  };

  const discovery: Discovery<{ selectedAmount: number }> = {
    type: "gain_score",
    actorId: "p1",
    step: "select_amount",
    input: { selectedAmount: 2 },
  };

  // @ts-expect-error command actorId is required
  const missingCommandActorId: Command<{ amount: number }> = {
    type: "gain_score",
    input: { amount: 2 },
  };

  // @ts-expect-error command input is required
  const missingCommandInput: Command<{ amount: number }> = {
    type: "gain_score",
    actorId: "p1",
  };

  // @ts-expect-error discovery actorId is required
  const missingDiscoveryActorId: Discovery<{ selectedAmount: number }> = {
    type: "gain_score",
    step: "select_amount",
    input: { selectedAmount: 2 },
  };

  // @ts-expect-error discovery input is required
  const missingDiscoveryInput: Discovery<{ selectedAmount: number }> = {
    type: "gain_score",
    actorId: "p1",
    step: "select_amount",
  };

  expect(command.actorId).toBe("p1");
  expect(command.input.amount).toBe(2);
  expect(discovery.actorId).toBe("p1");
  expect(discovery.input.selectedAmount).toBe(2);
  expect(missingCommandActorId).toBeDefined();
  expect(missingCommandInput).toBeDefined();
  expect(missingDiscoveryActorId).toBeDefined();
  expect(missingDiscoveryInput).toBeDefined();
});

test("rootState infers plain canonical data directly through executor state", () => {
  const typedRootGame = new GameDefinitionBuilder("typed-root-game")
    .rootState(TypedCounterRootState)
    .initialStage(createStageFactory<object>()("gameEnd").automatic().build())
    .build();
  const executor = createGameExecutor(typedRootGame);
  const initialState = executor.createInitialState("seed-123");
  const updatedState = executor.executeCommand(initialState, {
    type: "missing_command",
    actorId: "p1",
    input: {},
  }).state;
  const counterValue: number = initialState.game.counter.value;
  const updatedCounterValue: number = updatedState.game.counter.value;

  expect(typedRootGame.initialStage.id).toBe("gameEnd");
  expect(counterValue).toBe(0);
  expect(updatedCounterValue).toBe(0);
});

test("game definition builder infers setup input through executor initialization", () => {
  const typedRootGame = new GameDefinitionBuilder("typed-root-game-with-input")
    .rootState(TypedCounterRootState)
    .setupInput(
      t.object({
        playerIds: t.array(t.string()),
      }),
    )
    .setup(({ input }) => {
      const typedPlayerIds: string[] = input.playerIds;

      expect(typedPlayerIds).toBeArray();
    })
    .initialStage(createStageFactory<object>()("gameEnd").automatic().build())
    .build();
  const executor = createGameExecutor(typedRootGame);
  const initialState = executor.createInitialState(
    {
      playerIds: ["p1", "p2"],
    },
    "seed-123",
  );

  function assertInvalidCreateInitialStateCalls() {
    // @ts-expect-error input is required when setupInput is declared
    executor.createInitialState("seed-123");

    // @ts-expect-error rngSeed is required
    executor.createInitialState({
      playerIds: ["p1", "p2"],
    });
  }

  const counterValue: number = initialState.game.counter.value;

  expect(counterValue).toBe(0);
  expect(assertInvalidCreateInitialStateCalls).toBeFunction();
});

test("game definition builder rejects non-object setup input schemas", () => {
  const builder = new GameDefinitionBuilder("invalid-setup-input");

  function assertInvalidSetupInputSchema() {
    // @ts-expect-error setupInput only accepts object schemas
    builder.setupInput(t.string());
  }

  expect(builder).toBeObject();
  expect(assertInvalidSetupInputSchema).toBeFunction();
});

test("game definition builder preserves facade generic before rootState", () => {
  const builder = new GameDefinitionBuilder<TypedCounterRootState>(
    "typed-facade-builder",
  ).setup(({ game }) => {
    game.increment();
    game.counter.value += 1;
  });

  const typedRootGame = builder
    .rootState(TypedCounterRootState)
    .initialStage(createStageFactory<object>()("gameEnd").automatic().build())
    .build();

  expect(typedRootGame.initialStage.id).toBe("gameEnd");
});

test("game definition builder only exposes stage-based progression authoring", () => {
  const defineStage = createStageFactory<{ score: number }>();
  const gameEndStage = defineStage("gameEnd").automatic().build();

  const builder = new GameDefinitionBuilder<{
    score: number;
  }>("score-game");

  // @ts-expect-error commands should not exist on the stage-based builder
  void builder.commands;

  // @ts-expect-error progression should not exist on the stage-based builder
  void builder.progression;

  const stageBuilder = new GameDefinitionBuilder<{
    score: number;
  }>("score-game").initialStage(gameEndStage);

  expect(stageBuilder).toBeObject();
});

test("consumer command definitions infer step-authored discovery and reject legacy config", () => {
  const defineCommand = createCommandFactory<{
    increment(): void;
  }>();

  const gainScoreCommandSchema = t.object({
    amount: t.number(),
  });
  const draftSchema = t.object({
    amount: t.optional(t.number()),
  });
  const outputSchema = t.object({
    label: t.string(),
    amount: t.number(),
  });

  function assertExplicitBuiltStepDiscoveryAccepted() {
    const discoveryStep = null as unknown as DiscoveryStepFactory;

    const definition = defineCommand({
      commandId: "gain_score",
      commandSchema: gainScoreCommandSchema,
    })
      .discoverable(
        discoveryStep("select_amount")
          .initial()
          .input(draftSchema)
          .output(outputSchema)
          .resolve(
            ({
              discovery,
            }: {
              discovery: {
                input: {
                  amount?: number;
                };
              };
            }) => {
              const amount: number | undefined = discovery.input.amount;

              if (typeof amount !== "number") {
                return [
                  {
                    id: "amount-1",
                    output: {
                      label: "One",
                      amount: 1,
                    },
                    nextInput: {
                      amount: 1,
                    },
                    nextStep: "select_amount",
                  },
                ];
              }

              return {
                complete: true as const,
                input: {
                  amount,
                },
              };
            },
          )
          .build(),
      )
      .validate(({ command }) => {
        const amount: number = command.input.amount;

        return {
          ok: typeof amount === "number",
          reason: "amount_required",
        };
      })
      .execute(({ game, command }) => {
        game.increment();
        const amount: number = command.input.amount;
        void amount;
      })
      .build();

    expect(definition.commandId).toBe("gain_score");
    expect(definition.discovery?.startStep).toBe("select_amount");
    expect(definition.discovery?.steps[0]?.inputSchema).toBe(draftSchema);
    expect(definition.discovery?.steps[0]?.outputSchema).toBe(outputSchema);
  }

  function assertLegacyFlowDiscoveryRejected() {
    const invalidConfigDefinition = defineCommand({
      commandId: "legacy_gain_score",
      commandSchema: gainScoreCommandSchema,
    });

    // @ts-expect-error discoverable should reject the legacy flow callback builder
    const invalidFlowDefinition = invalidConfigDefinition.discoverable((flow) =>
      flow.step("select_amount", (step) =>
        step
          .input(draftSchema)
          .output(outputSchema)
          .resolve(() => []),
      ),
    );

    return invalidFlowDefinition;
  }

  expect(assertExplicitBuiltStepDiscoveryAccepted).toBeFunction();
  expect(assertLegacyFlowDiscoveryRejected).toBeFunction();
});

test("command factory contextually types command lifecycle methods", () => {
  const defineCommand = createCommandFactory<{
    score: number;
    increment(): void;
  }>();

  const commandSchema = t.object({
    amount: t.number(),
  });
  const draftSchema = t.object({
    selectedAmount: t.optional(t.number()),
  });

  const command = defineCommand({
    commandId: "gain_score",
    commandSchema,
  })
    .isAvailable(({ game, actorId, runtime, commandType }) => {
      expect(typeof game.score).toBe("number");
      void game.increment;
      void actorId;
      void runtime.progression.currentStage.id;
      expect(commandType).toBe("gain_score");
      return true;
    })
    .discoverable((flow) =>
      flow.step("select_amount", (step) =>
        step
          .input(draftSchema)
          .output(t.object({ amount: t.number() }))
          .resolve(({ discovery }) => {
            const selectedAmount: number | undefined =
              discovery.input.selectedAmount;

            if (typeof selectedAmount !== "number") {
              return [
                {
                  id: "one",
                  output: {
                    amount: 1,
                  },
                  nextInput: {
                    selectedAmount: 1,
                  },
                },
              ];
            }

            return {
              complete: true as const,
              input: {
                amount: selectedAmount,
              },
            };
          }),
      ),
    )
    .validate(({ command }) => {
      expect(command.input.amount).toBeNumber();
      return { ok: true as const };
    })
    .execute(({ game, command }) => {
      game.increment();
      expect(command.input.amount).toBeNumber();
    })
    .build();

  expect(command.commandId).toBe("gain_score");
  expect(command.commandSchema).toBe(commandSchema);
  expect(command.discovery?.steps[0]?.defaultNextStep).toBeUndefined();
});

test("step builder only exposes resolve after input and output are set", () => {
  const defineCommand = createCommandFactory<{
    counter: number;
  }>();

  const commandSchema = t.object({
    amount: t.number(),
  });
  const stepInputSchema = t.object({});
  const stepOutputSchema = t.object({
    amount: t.number(),
  });

  const command = defineCommand({
    commandId: "increment",
    commandSchema,
  }).discoverable((flow) =>
    flow.step("select_amount", (step) => {
      // @ts-expect-error resolve should not exist before input and output are set
      void step.resolve;
      // @ts-expect-error output should not exist before input is set
      void step.output;

      const withInput = step.input(stepInputSchema);

      // @ts-expect-error input should not exist after input is set
      void withInput.input;

      const withOutput = withInput.output(stepOutputSchema);

      // @ts-expect-error input should not exist after input and output are set
      void withOutput.input;
      // @ts-expect-error output should not exist after input and output are set
      void withOutput.output;
      withOutput.resolve(({ discovery }) => {
        void discovery.step;
        return [];
      });
    }),
  );

  expect(command).toBeObject();
});

test("command builder hides invalid chained methods at each stage", () => {
  const defineCommand = createCommandFactory<{
    counter: number;
  }>();

  const commandSchema = t.object({
    amount: t.number(),
  });
  const discoverySchema = t.object({
    selectedAmount: t.optional(t.number()),
  });

  const baseBuilder = defineCommand({
    commandId: "increment",
    commandSchema,
  });

  // @ts-expect-error build should not exist before validate and execute are set
  void baseBuilder.build;

  const validatedBuilder = baseBuilder.validate(() => ({ ok: true as const }));

  // @ts-expect-error build should not exist before execute is set
  void validatedBuilder.build;

  const executedBuilder = defineCommand({
    commandId: "increment_without_validate",
    commandSchema,
  }).execute(({ game, command }) => {
    game.counter += command.input.amount;
  });

  // @ts-expect-error build should not exist before validate is set
  void executedBuilder.build;

  const discoverableBuilder = baseBuilder.discoverable((flow) =>
    flow.step("select_amount", (step) =>
      step
        .input(discoverySchema)
        .output(t.object({ amount: t.number() }))
        .resolve(({ discovery }) => {
          if (typeof discovery.input.selectedAmount !== "number") {
            return [
              {
                id: "one",
                output: {
                  amount: 1,
                },
                nextInput: {
                  selectedAmount: 1,
                },
              },
            ];
          }

          return {
            complete: true as const,
            input: {
              amount: discovery.input.selectedAmount,
            },
          };
        }),
    ),
  );

  // @ts-expect-error discovery should only be configurable once
  void discoverableBuilder.discoverable;

  expect(baseBuilder).toBeObject();
  expect(validatedBuilder).toBeObject();
  expect(executedBuilder).toBeObject();
  expect(discoverableBuilder).toBeObject();
});

test("internal command definitions still expose canonical state separately from facade state", () => {
  const gainScoreCommandSchema = t.object({
    amount: t.number(),
  });
  type GainScoreInput = typeof gainScoreCommandSchema.static;

  const definition: InternalCommandDefinition<
    { score: number },
    { increment(): void },
    RuntimeState,
    GainScoreInput
  > = {
    commandId: "gain_score",
    commandSchema: gainScoreCommandSchema,
    validate: ({ game, state, command }) => {
      void game.increment;
      void state.game.score;
      const amount: number = command.input.amount;
      return {
        ok: amount > 0,
        reason: "amount_required",
      };
    },
    execute: ({ game, state, command }) => {
      game.increment();
      void state.game.score;
      const amount: number = command.input.amount;
      void amount;
    },
  };

  const context: InternalExecuteContext<
    { score: number },
    { increment(): void },
    RuntimeState,
    CommandFromSchema<GainScoreInput>
  > = {
    state: {
      game: {
        score: 1,
      },
      runtime: {
        progression: {
          currentStage: {
            id: "gameEnd",
            kind: "automatic",
          },
          lastActingStage: null,
        },
        rng: {
          seed: "seed",
          cursor: 0,
        },
        history: {
          entries: [],
        },
      },
    },
    game: {
      increment() {},
    },
    runtime: {
      progression: {
        currentStage: {
          id: "gameEnd",
          kind: "automatic",
        },
        lastActingStage: null,
      },
      rng: {
        seed: "seed",
        cursor: 0,
      },
      history: {
        entries: [],
      },
    },
    command: {
      type: "gain_score",
      actorId: "p1",
      input: {
        amount: 2,
      },
    },
    rng: {
      number() {
        return 0.5;
      },
      die() {
        return 1;
      },
      shuffle<T>(items: readonly T[]) {
        return [...items];
      },
    },
    emitEvent() {},
  };

  definition.execute(context);
  expect(definition.commandId).toBe("gain_score");
});
