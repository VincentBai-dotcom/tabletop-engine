export interface VisibleState {
  game: {
    playerOrder: string[];
    players: Record<
      string,
      {
        id: string;
        tokens: {
          white: number;
          blue: number;
          green: number;
          red: number;
          black: number;
          gold: number;
        };
        reservedCardIds:
          | number[]
          | {
              __hidden: true;
              value: {
                count: number;
              };
            };
        purchasedCardIds: number[];
        nobleIds: number[];
      }
    >;
    bank: {
      white: number;
      blue: number;
      green: number;
      red: number;
      black: number;
      gold: number;
    };
    board: {
      faceUpByLevel: Record<string, number[]>;
      deckByLevel: {
        __hidden: true;
        value: {
          "1": number;
          "2": number;
          "3": number;
        };
      };
      nobleIds: number[];
    };
    endGame?: {
      triggeredByPlayerId: string;
      endsAfterPlayerId: string;
    };
    winnerIds?: string[];
  };
  progression: {
    current: string | null;
    rootId: string | null;
    segments: Record<
      string,
      {
        id: string;
        kind?: string;
        parentId?: string;
        childIds: string[];
        active: boolean;
        ownerId?: string;
      }
    >;
  };
}

export type TakeThreeDistinctGemsCommandRequest = {
  type: "take_three_distinct_gems";
  actorId: string;
  input: {
    colors: string[];
  };
};

export type TakeThreeDistinctGemsDiscoveryRequest = {
  type: "take_three_distinct_gems";
  actorId: string;
  step: "select_gem_color";
  input: {
    selectedColors?: string[];
  };
};

export type TakeThreeDistinctGemsDiscoveryResult =
  | {
      complete: false;
      step: "select_gem_color";
      options: Array<{
        id: string;
        output: {
          color: string;
          selectedCount: number;
          requiredCount: number;
        };
        nextStep: "select_gem_color";
        nextInput: {
          selectedColors?: string[];
        };
      }>;
    }
  | {
      complete: true;
      input: {
        colors: string[];
      };
    };

export type TakeTwoSameGemsCommandRequest = {
  type: "take_two_same_gems";
  actorId: string;
  input: {
    color: string;
  };
};

export type TakeTwoSameGemsDiscoveryRequest = {
  type: "take_two_same_gems";
  actorId: string;
  step: "select_gem_color";
  input: {
    selectedColor?: string;
  };
};

export type TakeTwoSameGemsDiscoveryResult =
  | {
      complete: false;
      step: "select_gem_color";
      options: Array<{
        id: string;
        output: {
          color: string;
          amount: number;
        };
        nextStep: "select_gem_color";
        nextInput: {
          selectedColor?: string;
        };
      }>;
    }
  | {
      complete: true;
      input: {
        color: string;
      };
    };

export type ReserveFaceUpCardCommandRequest = {
  type: "reserve_face_up_card";
  actorId: string;
  input: {
    level: number;
    cardId: number;
  };
};

export type ReserveFaceUpCardDiscoveryRequest = {
  type: "reserve_face_up_card";
  actorId: string;
  step: "select_face_up_card";
  input: {
    selectedLevel?: number;
    selectedCardId?: number;
  };
};

export type ReserveFaceUpCardDiscoveryResult =
  | {
      complete: false;
      step: "select_face_up_card";
      options: Array<{
        id: string;
        output: {
          level: number;
          cardId: number;
          bonusColor: string;
          prestigePoints: number;
          source: string;
        };
        nextStep: "select_face_up_card";
        nextInput: {
          selectedLevel?: number;
          selectedCardId?: number;
        };
      }>;
    }
  | {
      complete: true;
      input: {
        level: number;
        cardId: number;
      };
    };

export type ReserveDeckCardCommandRequest = {
  type: "reserve_deck_card";
  actorId: string;
  input: {
    level: number;
  };
};

export type ReserveDeckCardDiscoveryRequest = {
  type: "reserve_deck_card";
  actorId: string;
  step: "select_deck_level";
  input: {
    selectedLevel?: number;
  };
};

export type ReserveDeckCardDiscoveryResult =
  | {
      complete: false;
      step: "select_deck_level";
      options: Array<{
        id: string;
        output: {
          level: number;
          cardCount: number;
          source: string;
        };
        nextStep: "select_deck_level";
        nextInput: {
          selectedLevel?: number;
        };
      }>;
    }
  | {
      complete: true;
      input: {
        level: number;
      };
    };

export type BuyFaceUpCardCommandRequest = {
  type: "buy_face_up_card";
  actorId: string;
  input: {
    level: number;
    cardId: number;
  };
};

export type BuyFaceUpCardDiscoveryRequest = {
  type: "buy_face_up_card";
  actorId: string;
  step: "select_face_up_card";
  input: {
    selectedLevel?: number;
    selectedCardId?: number;
  };
};

export type BuyFaceUpCardDiscoveryResult =
  | {
      complete: false;
      step: "select_face_up_card";
      options: Array<{
        id: string;
        output: {
          level: number;
          cardId: number;
          bonusColor: string;
          prestigePoints: number;
          source: string;
        };
        nextStep: "select_face_up_card";
        nextInput: {
          selectedLevel?: number;
          selectedCardId?: number;
        };
      }>;
    }
  | {
      complete: true;
      input: {
        level: number;
        cardId: number;
      };
    };

export type BuyReservedCardCommandRequest = {
  type: "buy_reserved_card";
  actorId: string;
  input: {
    cardId: number;
  };
};

export type BuyReservedCardDiscoveryRequest = {
  type: "buy_reserved_card";
  actorId: string;
  step: "select_reserved_card";
  input: {
    selectedCardId?: number;
  };
};

export type BuyReservedCardDiscoveryResult =
  | {
      complete: false;
      step: "select_reserved_card";
      options: Array<{
        id: string;
        output: {
          cardId: number;
          level: number;
          bonusColor: string;
          prestigePoints: number;
          source: string;
        };
        nextStep: "select_reserved_card";
        nextInput: {
          selectedCardId?: number;
        };
      }>;
    }
  | {
      complete: true;
      input: {
        cardId: number;
      };
    };

export type ReturnTokensCommandRequest = {
  type: "return_tokens";
  actorId: string;
  input: {
    returnTokens: Record<string, number>;
  };
};

export type ReturnTokensDiscoveryRequest = {
  type: "return_tokens";
  actorId: string;
  step: "select_return_token";
  input: {
    returnTokens?: Record<string, number>;
  };
};

export type ReturnTokensDiscoveryResult =
  | {
      complete: false;
      step: "select_return_token";
      options: Array<{
        id: string;
        output: {
          color: string;
          selectedCount: number;
          requiredReturnCount: number;
        };
        nextStep: "select_return_token";
        nextInput: {
          returnTokens?: Record<string, number>;
        };
      }>;
    }
  | {
      complete: true;
      input: {
        returnTokens: Record<string, number>;
      };
    };

export type ChooseNobleCommandRequest = {
  type: "choose_noble";
  actorId: string;
  input: {
    nobleId: number;
  };
};

export type ChooseNobleDiscoveryRequest = {
  type: "choose_noble";
  actorId: string;
  step: "select_noble";
  input: {
    chosenNobleId?: number;
  };
};

export type ChooseNobleDiscoveryResult =
  | {
      complete: false;
      step: "select_noble";
      options: Array<{
        id: string;
        output: {
          nobleId: number;
          name: string;
          requirements: {
            White: number;
            Blue: number;
            Black: number;
            Red: number;
            Green: number;
          };
        };
        nextStep: "select_noble";
        nextInput: {
          chosenNobleId?: number;
        };
      }>;
    }
  | {
      complete: true;
      input: {
        nobleId: number;
      };
    };

export type CommandRequest =
  | TakeThreeDistinctGemsCommandRequest
  | TakeTwoSameGemsCommandRequest
  | ReserveFaceUpCardCommandRequest
  | ReserveDeckCardCommandRequest
  | BuyFaceUpCardCommandRequest
  | BuyReservedCardCommandRequest
  | ReturnTokensCommandRequest
  | ChooseNobleCommandRequest;

export type DiscoveryRequest =
  | TakeThreeDistinctGemsDiscoveryRequest
  | TakeTwoSameGemsDiscoveryRequest
  | ReserveFaceUpCardDiscoveryRequest
  | ReserveDeckCardDiscoveryRequest
  | BuyFaceUpCardDiscoveryRequest
  | BuyReservedCardDiscoveryRequest
  | ReturnTokensDiscoveryRequest
  | ChooseNobleDiscoveryRequest;

export type DiscoveryResult =
  | TakeThreeDistinctGemsDiscoveryResult
  | TakeTwoSameGemsDiscoveryResult
  | ReserveFaceUpCardDiscoveryResult
  | ReserveDeckCardDiscoveryResult
  | BuyFaceUpCardDiscoveryResult
  | BuyReservedCardDiscoveryResult
  | ReturnTokensDiscoveryResult
  | ChooseNobleDiscoveryResult;

export type CommandType =
  | "take_three_distinct_gems"
  | "take_two_same_gems"
  | "reserve_face_up_card"
  | "reserve_deck_card"
  | "buy_face_up_card"
  | "buy_reserved_card"
  | "return_tokens"
  | "choose_noble";

export type WithoutActorId<T> = T extends unknown ? Omit<T, "actorId"> : never;

export type WithoutType<T> = T extends unknown ? Omit<T, "type"> : never;

export type TakeThreeDistinctGemsCommandPayload =
  WithoutActorId<TakeThreeDistinctGemsCommandRequest>;

export type TakeThreeDistinctGemsDiscoveryPayload =
  WithoutActorId<TakeThreeDistinctGemsDiscoveryRequest>;

export type TakeTwoSameGemsCommandPayload =
  WithoutActorId<TakeTwoSameGemsCommandRequest>;

export type TakeTwoSameGemsDiscoveryPayload =
  WithoutActorId<TakeTwoSameGemsDiscoveryRequest>;

export type ReserveFaceUpCardCommandPayload =
  WithoutActorId<ReserveFaceUpCardCommandRequest>;

export type ReserveFaceUpCardDiscoveryPayload =
  WithoutActorId<ReserveFaceUpCardDiscoveryRequest>;

export type ReserveDeckCardCommandPayload =
  WithoutActorId<ReserveDeckCardCommandRequest>;

export type ReserveDeckCardDiscoveryPayload =
  WithoutActorId<ReserveDeckCardDiscoveryRequest>;

export type BuyFaceUpCardCommandPayload =
  WithoutActorId<BuyFaceUpCardCommandRequest>;

export type BuyFaceUpCardDiscoveryPayload =
  WithoutActorId<BuyFaceUpCardDiscoveryRequest>;

export type BuyReservedCardCommandPayload =
  WithoutActorId<BuyReservedCardCommandRequest>;

export type BuyReservedCardDiscoveryPayload =
  WithoutActorId<BuyReservedCardDiscoveryRequest>;

export type ReturnTokensCommandPayload =
  WithoutActorId<ReturnTokensCommandRequest>;

export type ReturnTokensDiscoveryPayload =
  WithoutActorId<ReturnTokensDiscoveryRequest>;

export type ChooseNobleCommandPayload =
  WithoutActorId<ChooseNobleCommandRequest>;

export type ChooseNobleDiscoveryPayload =
  WithoutActorId<ChooseNobleDiscoveryRequest>;

export type CommandPayload =
  | TakeThreeDistinctGemsCommandPayload
  | TakeTwoSameGemsCommandPayload
  | ReserveFaceUpCardCommandPayload
  | ReserveDeckCardCommandPayload
  | BuyFaceUpCardCommandPayload
  | BuyReservedCardCommandPayload
  | ReturnTokensCommandPayload
  | ChooseNobleCommandPayload;

export type DiscoveryPayload =
  | TakeThreeDistinctGemsDiscoveryPayload
  | TakeTwoSameGemsDiscoveryPayload
  | ReserveFaceUpCardDiscoveryPayload
  | ReserveDeckCardDiscoveryPayload
  | BuyFaceUpCardDiscoveryPayload
  | BuyReservedCardDiscoveryPayload
  | ReturnTokensDiscoveryPayload
  | ChooseNobleDiscoveryPayload;

export interface GameListAvailableCommandsRequest {
  gameSessionId: string;
}

export interface GameAvailableCommandsMessage {
  type: "game_available_commands";
  requestId: string;
  gameSessionId: string;
  availableCommands: CommandType[];
}

export interface GameDiscoverRequest {
  gameSessionId: string;
  discovery: DiscoveryPayload;
}

export type GameDiscoveryResultEnvelope =
  | {
      type: "take_three_distinct_gems";
      result: TakeThreeDistinctGemsDiscoveryResult;
    }
  | {
      type: "take_two_same_gems";
      result: TakeTwoSameGemsDiscoveryResult;
    }
  | {
      type: "reserve_face_up_card";
      result: ReserveFaceUpCardDiscoveryResult;
    }
  | {
      type: "reserve_deck_card";
      result: ReserveDeckCardDiscoveryResult;
    }
  | {
      type: "buy_face_up_card";
      result: BuyFaceUpCardDiscoveryResult;
    }
  | {
      type: "buy_reserved_card";
      result: BuyReservedCardDiscoveryResult;
    }
  | {
      type: "return_tokens";
      result: ReturnTokensDiscoveryResult;
    }
  | {
      type: "choose_noble";
      result: ChooseNobleDiscoveryResult;
    };

export interface GameDiscoveryResultMessage {
  type: "game_discovery_result";
  requestId: string;
  gameSessionId: string;
  result: GameDiscoveryResultEnvelope | null;
}

export interface GameExecuteRequest {
  gameSessionId: string;
  command: CommandPayload;
}

export type GameExecutionResultMessage =
  | {
      type: "game_execution_result";
      requestId: string;
      gameSessionId: string;
      accepted: true;
      stateVersion: number;
      events: unknown[];
    }
  | {
      type: "game_execution_result";
      requestId: string;
      gameSessionId: string;
      accepted: false;
      stateVersion: number;
      reason: string;
      metadata?: unknown;
      events: unknown[];
    };

export interface GameSnapshotMessage {
  type: "game_snapshot";
  gameSessionId: string;
  stateVersion: number;
  view: VisibleState;
  availableCommands: CommandType[];
  events: unknown[];
}

export interface GameEndedResult {
  reason: "completed" | "invalidated";
  winnerPlayerIds?: string[];
  message?: string;
}

export interface GameEndedMessage {
  type: "game_ended";
  gameSessionId: string;
  result: GameEndedResult;
}

export interface GameEngineErrorMessage {
  type: "error";
  requestId?: string;
  code: string;
  message?: string;
}

export type GameEngineClientMessage =
  | {
      type: "game_list_available_commands";
      requestId: string;
      gameSessionId: string;
    }
  | {
      type: "game_discover";
      requestId: string;
      gameSessionId: string;
      discovery: DiscoveryPayload;
    }
  | {
      type: "game_execute";
      requestId: string;
      gameSessionId: string;
      command: CommandPayload;
    };

export type GameEngineServerMessage =
  | GameAvailableCommandsMessage
  | GameDiscoveryResultMessage
  | GameExecutionResultMessage
  | GameSnapshotMessage
  | GameEndedMessage
  | GameEngineErrorMessage;

export type TakeThreeDistinctGemsDiscoveryStart = {
  step: "select_gem_color";
  input: {
    selectedColors?: string[];
  };
};

export const takeThreeDistinctGemsDiscoveryStart = {
  step: "select_gem_color",
  input: {},
} satisfies TakeThreeDistinctGemsDiscoveryStart;

export type TakeTwoSameGemsDiscoveryStart = {
  step: "select_gem_color";
  input: {
    selectedColor?: string;
  };
};

export const takeTwoSameGemsDiscoveryStart = {
  step: "select_gem_color",
  input: {},
} satisfies TakeTwoSameGemsDiscoveryStart;

export type ReserveFaceUpCardDiscoveryStart = {
  step: "select_face_up_card";
  input: {
    selectedLevel?: number;
    selectedCardId?: number;
  };
};

export const reserveFaceUpCardDiscoveryStart = {
  step: "select_face_up_card",
  input: {},
} satisfies ReserveFaceUpCardDiscoveryStart;

export type ReserveDeckCardDiscoveryStart = {
  step: "select_deck_level";
  input: {
    selectedLevel?: number;
  };
};

export const reserveDeckCardDiscoveryStart = {
  step: "select_deck_level",
  input: {},
} satisfies ReserveDeckCardDiscoveryStart;

export type BuyFaceUpCardDiscoveryStart = {
  step: "select_face_up_card";
  input: {
    selectedLevel?: number;
    selectedCardId?: number;
  };
};

export const buyFaceUpCardDiscoveryStart = {
  step: "select_face_up_card",
  input: {},
} satisfies BuyFaceUpCardDiscoveryStart;

export type BuyReservedCardDiscoveryStart = {
  step: "select_reserved_card";
  input: {
    selectedCardId?: number;
  };
};

export const buyReservedCardDiscoveryStart = {
  step: "select_reserved_card",
  input: {},
} satisfies BuyReservedCardDiscoveryStart;

export type ReturnTokensDiscoveryStart = {
  step: "select_return_token";
  input: {
    returnTokens?: Record<string, number>;
  };
};

export const returnTokensDiscoveryStart = {
  step: "select_return_token",
  input: {},
} satisfies ReturnTokensDiscoveryStart;

export type ChooseNobleDiscoveryStart = {
  step: "select_noble";
  input: {
    chosenNobleId?: number;
  };
};

export const chooseNobleDiscoveryStart = {
  step: "select_noble",
  input: {},
} satisfies ChooseNobleDiscoveryStart;

export interface GameEngineSocketLike {
  send(data: string): void;
  addEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void;
  addEventListener(type: "close" | "error", listener: () => void): void;
  removeEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void;
  removeEventListener(type: "close" | "error", listener: () => void): void;
}

export interface GameEngineClientOptions {
  createRequestId?: () => string;
}

export interface GameEngineClient {
  listAvailableCommands(
    request: GameListAvailableCommandsRequest,
  ): Promise<GameAvailableCommandsMessage>;
  discover(request: GameDiscoverRequest): Promise<GameDiscoveryResultMessage>;
  execute(request: GameExecuteRequest): Promise<GameExecutionResultMessage>;
  discoverTakeThreeDistinctGems(
    request: {
      gameSessionId: string;
    } & WithoutType<TakeThreeDistinctGemsDiscoveryPayload>,
  ): Promise<GameDiscoveryResultMessage>;
  discoverTakeTwoSameGems(
    request: {
      gameSessionId: string;
    } & WithoutType<TakeTwoSameGemsDiscoveryPayload>,
  ): Promise<GameDiscoveryResultMessage>;
  discoverReserveFaceUpCard(
    request: {
      gameSessionId: string;
    } & WithoutType<ReserveFaceUpCardDiscoveryPayload>,
  ): Promise<GameDiscoveryResultMessage>;
  discoverReserveDeckCard(
    request: {
      gameSessionId: string;
    } & WithoutType<ReserveDeckCardDiscoveryPayload>,
  ): Promise<GameDiscoveryResultMessage>;
  discoverBuyFaceUpCard(
    request: {
      gameSessionId: string;
    } & WithoutType<BuyFaceUpCardDiscoveryPayload>,
  ): Promise<GameDiscoveryResultMessage>;
  discoverBuyReservedCard(
    request: {
      gameSessionId: string;
    } & WithoutType<BuyReservedCardDiscoveryPayload>,
  ): Promise<GameDiscoveryResultMessage>;
  discoverReturnTokens(
    request: {
      gameSessionId: string;
    } & WithoutType<ReturnTokensDiscoveryPayload>,
  ): Promise<GameDiscoveryResultMessage>;
  discoverChooseNoble(
    request: {
      gameSessionId: string;
    } & WithoutType<ChooseNobleDiscoveryPayload>,
  ): Promise<GameDiscoveryResultMessage>;
  executeTakeThreeDistinctGems(request: {
    gameSessionId: string;
    input: TakeThreeDistinctGemsCommandPayload["input"];
  }): Promise<GameExecutionResultMessage>;
  executeTakeTwoSameGems(request: {
    gameSessionId: string;
    input: TakeTwoSameGemsCommandPayload["input"];
  }): Promise<GameExecutionResultMessage>;
  executeReserveFaceUpCard(request: {
    gameSessionId: string;
    input: ReserveFaceUpCardCommandPayload["input"];
  }): Promise<GameExecutionResultMessage>;
  executeReserveDeckCard(request: {
    gameSessionId: string;
    input: ReserveDeckCardCommandPayload["input"];
  }): Promise<GameExecutionResultMessage>;
  executeBuyFaceUpCard(request: {
    gameSessionId: string;
    input: BuyFaceUpCardCommandPayload["input"];
  }): Promise<GameExecutionResultMessage>;
  executeBuyReservedCard(request: {
    gameSessionId: string;
    input: BuyReservedCardCommandPayload["input"];
  }): Promise<GameExecutionResultMessage>;
  executeReturnTokens(request: {
    gameSessionId: string;
    input: ReturnTokensCommandPayload["input"];
  }): Promise<GameExecutionResultMessage>;
  executeChooseNoble(request: {
    gameSessionId: string;
    input: ChooseNobleCommandPayload["input"];
  }): Promise<GameExecutionResultMessage>;
  onGameSnapshot(handler: (message: GameSnapshotMessage) => void): () => void;
  onGameEnded(handler: (message: GameEndedMessage) => void): () => void;
  onDiscoveryResult(
    handler: (message: GameDiscoveryResultMessage) => void,
  ): () => void;
  onExecutionResult(
    handler: (message: GameExecutionResultMessage) => void,
  ): () => void;
  onMessage(handler: (message: GameEngineServerMessage) => void): () => void;
  dispose(): void;
}

export function createGameEngineClient(
  socket: GameEngineSocketLike,
  options: GameEngineClientOptions = {},
): GameEngineClient {
  const pendingAvailableCommands = new Map<
    string,
    {
      resolve: (message: GameAvailableCommandsMessage) => void;
      reject: (error: Error) => void;
    }
  >();
  const pendingDiscovery = new Map<
    string,
    {
      resolve: (message: GameDiscoveryResultMessage) => void;
      reject: (error: Error) => void;
    }
  >();
  const pendingExecution = new Map<
    string,
    {
      resolve: (message: GameExecutionResultMessage) => void;
      reject: (error: Error) => void;
    }
  >();
  const gameSnapshotListeners = new Set<
    (message: GameSnapshotMessage) => void
  >();
  const gameEndedListeners = new Set<(message: GameEndedMessage) => void>();
  const discoveryResultListeners = new Set<
    (message: GameDiscoveryResultMessage) => void
  >();
  const executionResultListeners = new Set<
    (message: GameExecutionResultMessage) => void
  >();
  const messageListeners = new Set<
    (message: GameEngineServerMessage) => void
  >();
  let requestCounter = 0;

  const createRequestId =
    options.createRequestId ??
    (() => {
      requestCounter += 1;

      if (
        typeof globalThis.crypto !== "undefined" &&
        typeof globalThis.crypto.randomUUID === "function"
      ) {
        return globalThis.crypto.randomUUID();
      }

      return `game-engine-request-${requestCounter}`;
    });

  const parseIncomingMessage = (
    raw: unknown,
  ): GameEngineServerMessage | null => {
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as GameEngineServerMessage;
      } catch {
        return null;
      }
    }

    if (typeof raw === "object" && raw !== null) {
      return raw as GameEngineServerMessage;
    }

    return null;
  };

  const handleMessage = (event: { data: unknown }) => {
    const message = parseIncomingMessage(event.data);

    if (!message) {
      return;
    }

    for (const listener of messageListeners) {
      listener(message);
    }

    switch (message.type) {
      case "game_available_commands": {
        const pending = pendingAvailableCommands.get(message.requestId);
        if (pending) {
          pendingAvailableCommands.delete(message.requestId);
          pending.resolve(message);
        }
        return;
      }

      case "game_discovery_result": {
        for (const listener of discoveryResultListeners) {
          listener(message);
        }
        const pending = pendingDiscovery.get(message.requestId);
        if (pending) {
          pendingDiscovery.delete(message.requestId);
          pending.resolve(message);
        }
        return;
      }

      case "game_execution_result": {
        for (const listener of executionResultListeners) {
          listener(message);
        }
        const pending = pendingExecution.get(message.requestId);
        if (pending) {
          pendingExecution.delete(message.requestId);
          pending.resolve(message);
        }
        return;
      }

      case "error":
        if (!message.requestId) {
          return;
        }

        {
          const error = new Error(message.message ?? message.code);
          const availableCommandsPending = pendingAvailableCommands.get(
            message.requestId,
          );
          if (availableCommandsPending) {
            pendingAvailableCommands.delete(message.requestId);
            availableCommandsPending.reject(error);
            return;
          }

          const discoveryPending = pendingDiscovery.get(message.requestId);
          if (discoveryPending) {
            pendingDiscovery.delete(message.requestId);
            discoveryPending.reject(error);
            return;
          }

          const executionPending = pendingExecution.get(message.requestId);
          if (executionPending) {
            pendingExecution.delete(message.requestId);
            executionPending.reject(error);
          }
        }
        return;

      case "game_snapshot":
        for (const listener of gameSnapshotListeners) {
          listener(message);
        }
        return;

      case "game_ended":
        for (const listener of gameEndedListeners) {
          listener(message);
        }
        return;
    }
  };

  const handleSocketClosed = () => {
    rejectPendingRequests("Game engine socket closed");
  };

  const handleSocketErrored = () => {
    rejectPendingRequests("Game engine socket errored");
  };

  socket.addEventListener("message", handleMessage);
  socket.addEventListener("close", handleSocketClosed);
  socket.addEventListener("error", handleSocketErrored);

  const send = (message: GameEngineClientMessage) => {
    socket.send(JSON.stringify(message));
  };

  const rejectPendingRequests = (reason: string) => {
    const error = new Error(reason);

    for (const [requestId, pending] of pendingAvailableCommands) {
      pending.reject(error);
      pendingAvailableCommands.delete(requestId);
    }

    for (const [requestId, pending] of pendingDiscovery) {
      pending.reject(error);
      pendingDiscovery.delete(requestId);
    }

    for (const [requestId, pending] of pendingExecution) {
      pending.reject(error);
      pendingExecution.delete(requestId);
    }
  };

  return {
    listAvailableCommands(request) {
      const requestId = createRequestId();
      return new Promise<GameAvailableCommandsMessage>((resolve, reject) => {
        pendingAvailableCommands.set(requestId, { resolve, reject });
        send({
          type: "game_list_available_commands",
          requestId,
          gameSessionId: request.gameSessionId,
        });
      });
    },
    discover(request) {
      const requestId = createRequestId();
      return new Promise<GameDiscoveryResultMessage>((resolve, reject) => {
        pendingDiscovery.set(requestId, { resolve, reject });
        send({
          type: "game_discover",
          requestId,
          gameSessionId: request.gameSessionId,
          discovery: request.discovery,
        });
      });
    },
    execute(request) {
      const requestId = createRequestId();
      return new Promise<GameExecutionResultMessage>((resolve, reject) => {
        pendingExecution.set(requestId, { resolve, reject });
        send({
          type: "game_execute",
          requestId,
          gameSessionId: request.gameSessionId,
          command: request.command,
        });
      });
    },
    discoverTakeThreeDistinctGems(
      request: {
        gameSessionId: string;
      } & WithoutType<TakeThreeDistinctGemsDiscoveryPayload>,
    ) {
      const discovery = {
        type: "take_three_distinct_gems",
        step: request.step,
        input: request.input,
      } as TakeThreeDistinctGemsDiscoveryPayload;

      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery,
      });
    },
    discoverTakeTwoSameGems(
      request: {
        gameSessionId: string;
      } & WithoutType<TakeTwoSameGemsDiscoveryPayload>,
    ) {
      const discovery = {
        type: "take_two_same_gems",
        step: request.step,
        input: request.input,
      } as TakeTwoSameGemsDiscoveryPayload;

      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery,
      });
    },
    discoverReserveFaceUpCard(
      request: {
        gameSessionId: string;
      } & WithoutType<ReserveFaceUpCardDiscoveryPayload>,
    ) {
      const discovery = {
        type: "reserve_face_up_card",
        step: request.step,
        input: request.input,
      } as ReserveFaceUpCardDiscoveryPayload;

      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery,
      });
    },
    discoverReserveDeckCard(
      request: {
        gameSessionId: string;
      } & WithoutType<ReserveDeckCardDiscoveryPayload>,
    ) {
      const discovery = {
        type: "reserve_deck_card",
        step: request.step,
        input: request.input,
      } as ReserveDeckCardDiscoveryPayload;

      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery,
      });
    },
    discoverBuyFaceUpCard(
      request: {
        gameSessionId: string;
      } & WithoutType<BuyFaceUpCardDiscoveryPayload>,
    ) {
      const discovery = {
        type: "buy_face_up_card",
        step: request.step,
        input: request.input,
      } as BuyFaceUpCardDiscoveryPayload;

      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery,
      });
    },
    discoverBuyReservedCard(
      request: {
        gameSessionId: string;
      } & WithoutType<BuyReservedCardDiscoveryPayload>,
    ) {
      const discovery = {
        type: "buy_reserved_card",
        step: request.step,
        input: request.input,
      } as BuyReservedCardDiscoveryPayload;

      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery,
      });
    },
    discoverReturnTokens(
      request: {
        gameSessionId: string;
      } & WithoutType<ReturnTokensDiscoveryPayload>,
    ) {
      const discovery = {
        type: "return_tokens",
        step: request.step,
        input: request.input,
      } as ReturnTokensDiscoveryPayload;

      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery,
      });
    },
    discoverChooseNoble(
      request: {
        gameSessionId: string;
      } & WithoutType<ChooseNobleDiscoveryPayload>,
    ) {
      const discovery = {
        type: "choose_noble",
        step: request.step,
        input: request.input,
      } as ChooseNobleDiscoveryPayload;

      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery,
      });
    },
    executeTakeThreeDistinctGems(request: {
      gameSessionId: string;
      input: TakeThreeDistinctGemsCommandPayload["input"];
    }) {
      return this.execute({
        gameSessionId: request.gameSessionId,
        command: {
          type: "take_three_distinct_gems",
          input: request.input,
        },
      });
    },
    executeTakeTwoSameGems(request: {
      gameSessionId: string;
      input: TakeTwoSameGemsCommandPayload["input"];
    }) {
      return this.execute({
        gameSessionId: request.gameSessionId,
        command: {
          type: "take_two_same_gems",
          input: request.input,
        },
      });
    },
    executeReserveFaceUpCard(request: {
      gameSessionId: string;
      input: ReserveFaceUpCardCommandPayload["input"];
    }) {
      return this.execute({
        gameSessionId: request.gameSessionId,
        command: {
          type: "reserve_face_up_card",
          input: request.input,
        },
      });
    },
    executeReserveDeckCard(request: {
      gameSessionId: string;
      input: ReserveDeckCardCommandPayload["input"];
    }) {
      return this.execute({
        gameSessionId: request.gameSessionId,
        command: {
          type: "reserve_deck_card",
          input: request.input,
        },
      });
    },
    executeBuyFaceUpCard(request: {
      gameSessionId: string;
      input: BuyFaceUpCardCommandPayload["input"];
    }) {
      return this.execute({
        gameSessionId: request.gameSessionId,
        command: {
          type: "buy_face_up_card",
          input: request.input,
        },
      });
    },
    executeBuyReservedCard(request: {
      gameSessionId: string;
      input: BuyReservedCardCommandPayload["input"];
    }) {
      return this.execute({
        gameSessionId: request.gameSessionId,
        command: {
          type: "buy_reserved_card",
          input: request.input,
        },
      });
    },
    executeReturnTokens(request: {
      gameSessionId: string;
      input: ReturnTokensCommandPayload["input"];
    }) {
      return this.execute({
        gameSessionId: request.gameSessionId,
        command: {
          type: "return_tokens",
          input: request.input,
        },
      });
    },
    executeChooseNoble(request: {
      gameSessionId: string;
      input: ChooseNobleCommandPayload["input"];
    }) {
      return this.execute({
        gameSessionId: request.gameSessionId,
        command: {
          type: "choose_noble",
          input: request.input,
        },
      });
    },
    onGameSnapshot(handler) {
      gameSnapshotListeners.add(handler);
      return () => {
        gameSnapshotListeners.delete(handler);
      };
    },
    onGameEnded(handler) {
      gameEndedListeners.add(handler);
      return () => {
        gameEndedListeners.delete(handler);
      };
    },
    onDiscoveryResult(handler) {
      discoveryResultListeners.add(handler);
      return () => {
        discoveryResultListeners.delete(handler);
      };
    },
    onExecutionResult(handler) {
      executionResultListeners.add(handler);
      return () => {
        executionResultListeners.delete(handler);
      };
    },
    onMessage(handler) {
      messageListeners.add(handler);
      return () => {
        messageListeners.delete(handler);
      };
    },
    dispose() {
      rejectPendingRequests("Game engine client disposed");
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleSocketClosed);
      socket.removeEventListener("error", handleSocketErrored);
      gameSnapshotListeners.clear();
      gameEndedListeners.clear();
      discoveryResultListeners.clear();
      executionResultListeners.clear();
      messageListeners.clear();
    },
  };
}
