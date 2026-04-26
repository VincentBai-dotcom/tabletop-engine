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
    returnTokens?: Record<string, number>;
  };
};

export type TakeThreeDistinctGemsDiscoveryRequest =
  | {
      type: "take_three_distinct_gems";
      actorId: string;
      step: "select_gem_color";
      input: {
        selectedColors?: string[];
        returnTokens?: Record<string, number>;
      };
    }
  | {
      type: "take_three_distinct_gems";
      actorId: string;
      step: "select_return_token";
      input: {
        selectedColors: string[];
        returnTokens?: Record<string, number>;
      };
    };

export type TakeThreeDistinctGemsDiscoveryResult =
  | {
      complete: false;
      step: "select_gem_color";
      options: Array<
        | {
            id: string;
            output: {
              color: string;
              selectedCount: number;
              requiredCount: number;
            };
            nextStep: "select_gem_color";
            nextInput: {
              selectedColors?: string[];
              returnTokens?: Record<string, number>;
            };
          }
        | {
            id: string;
            output: {
              color: string;
              selectedCount: number;
              requiredCount: number;
            };
            nextStep: "select_return_token";
            nextInput: {
              selectedColors: string[];
              returnTokens?: Record<string, number>;
            };
          }
      >;
    }
  | {
      complete: false;
      step: "select_return_token";
      options: Array<
        | {
            id: string;
            output: {
              color: string;
              selectedCount: number;
              requiredReturnCount: number;
            };
            nextStep: "select_gem_color";
            nextInput: {
              selectedColors?: string[];
              returnTokens?: Record<string, number>;
            };
          }
        | {
            id: string;
            output: {
              color: string;
              selectedCount: number;
              requiredReturnCount: number;
            };
            nextStep: "select_return_token";
            nextInput: {
              selectedColors: string[];
              returnTokens?: Record<string, number>;
            };
          }
      >;
    }
  | {
      complete: true;
      input: {
        colors: string[];
        returnTokens?: Record<string, number>;
      };
    };

export type TakeTwoSameGemsCommandRequest = {
  type: "take_two_same_gems";
  actorId: string;
  input: {
    color: string;
    returnTokens?: Record<string, number>;
  };
};

export type TakeTwoSameGemsDiscoveryRequest =
  | {
      type: "take_two_same_gems";
      actorId: string;
      step: "select_gem_color";
      input: {
        selectedColor?: string;
        returnTokens?: Record<string, number>;
      };
    }
  | {
      type: "take_two_same_gems";
      actorId: string;
      step: "select_return_token";
      input: {
        selectedColor: string;
        returnTokens?: Record<string, number>;
      };
    };

export type TakeTwoSameGemsDiscoveryResult =
  | {
      complete: false;
      step: "select_gem_color";
      options: Array<
        | {
            id: string;
            output: {
              color: string;
              amount: number;
            };
            nextStep: "select_gem_color";
            nextInput: {
              selectedColor?: string;
              returnTokens?: Record<string, number>;
            };
          }
        | {
            id: string;
            output: {
              color: string;
              amount: number;
            };
            nextStep: "select_return_token";
            nextInput: {
              selectedColor: string;
              returnTokens?: Record<string, number>;
            };
          }
      >;
    }
  | {
      complete: false;
      step: "select_return_token";
      options: Array<
        | {
            id: string;
            output: {
              color: string;
              selectedCount: number;
              requiredReturnCount: number;
            };
            nextStep: "select_gem_color";
            nextInput: {
              selectedColor?: string;
              returnTokens?: Record<string, number>;
            };
          }
        | {
            id: string;
            output: {
              color: string;
              selectedCount: number;
              requiredReturnCount: number;
            };
            nextStep: "select_return_token";
            nextInput: {
              selectedColor: string;
              returnTokens?: Record<string, number>;
            };
          }
      >;
    }
  | {
      complete: true;
      input: {
        color: string;
        returnTokens?: Record<string, number>;
      };
    };

export type ReserveFaceUpCardCommandRequest = {
  type: "reserve_face_up_card";
  actorId: string;
  input: {
    level: number;
    cardId: number;
    returnTokens?: Record<string, number>;
  };
};

export type ReserveFaceUpCardDiscoveryRequest =
  | {
      type: "reserve_face_up_card";
      actorId: string;
      step: "select_face_up_card";
      input: {
        selectedLevel?: number;
        selectedCardId?: number;
        returnTokens?: Record<string, number>;
      };
    }
  | {
      type: "reserve_face_up_card";
      actorId: string;
      step: "select_return_token";
      input: {
        selectedLevel: number;
        selectedCardId: number;
        returnTokens?: Record<string, number>;
      };
    };

export type ReserveFaceUpCardDiscoveryResult =
  | {
      complete: false;
      step: "select_face_up_card";
      options: Array<
        | {
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
              returnTokens?: Record<string, number>;
            };
          }
        | {
            id: string;
            output: {
              level: number;
              cardId: number;
              bonusColor: string;
              prestigePoints: number;
              source: string;
            };
            nextStep: "select_return_token";
            nextInput: {
              selectedLevel: number;
              selectedCardId: number;
              returnTokens?: Record<string, number>;
            };
          }
      >;
    }
  | {
      complete: false;
      step: "select_return_token";
      options: Array<
        | {
            id: string;
            output: {
              color: string;
              selectedCount: number;
              requiredReturnCount: number;
            };
            nextStep: "select_face_up_card";
            nextInput: {
              selectedLevel?: number;
              selectedCardId?: number;
              returnTokens?: Record<string, number>;
            };
          }
        | {
            id: string;
            output: {
              color: string;
              selectedCount: number;
              requiredReturnCount: number;
            };
            nextStep: "select_return_token";
            nextInput: {
              selectedLevel: number;
              selectedCardId: number;
              returnTokens?: Record<string, number>;
            };
          }
      >;
    }
  | {
      complete: true;
      input: {
        level: number;
        cardId: number;
        returnTokens?: Record<string, number>;
      };
    };

export type ReserveDeckCardCommandRequest = {
  type: "reserve_deck_card";
  actorId: string;
  input: {
    level: number;
    returnTokens?: Record<string, number>;
  };
};

export type ReserveDeckCardDiscoveryRequest =
  | {
      type: "reserve_deck_card";
      actorId: string;
      step: "select_deck_level";
      input: {
        selectedLevel?: number;
        returnTokens?: Record<string, number>;
      };
    }
  | {
      type: "reserve_deck_card";
      actorId: string;
      step: "select_return_token";
      input: {
        selectedLevel: number;
        returnTokens?: Record<string, number>;
      };
    };

export type ReserveDeckCardDiscoveryResult =
  | {
      complete: false;
      step: "select_deck_level";
      options: Array<
        | {
            id: string;
            output: {
              level: number;
              cardCount: number;
              source: string;
            };
            nextStep: "select_deck_level";
            nextInput: {
              selectedLevel?: number;
              returnTokens?: Record<string, number>;
            };
          }
        | {
            id: string;
            output: {
              level: number;
              cardCount: number;
              source: string;
            };
            nextStep: "select_return_token";
            nextInput: {
              selectedLevel: number;
              returnTokens?: Record<string, number>;
            };
          }
      >;
    }
  | {
      complete: false;
      step: "select_return_token";
      options: Array<
        | {
            id: string;
            output: {
              color: string;
              selectedCount: number;
              requiredReturnCount: number;
            };
            nextStep: "select_deck_level";
            nextInput: {
              selectedLevel?: number;
              returnTokens?: Record<string, number>;
            };
          }
        | {
            id: string;
            output: {
              color: string;
              selectedCount: number;
              requiredReturnCount: number;
            };
            nextStep: "select_return_token";
            nextInput: {
              selectedLevel: number;
              returnTokens?: Record<string, number>;
            };
          }
      >;
    }
  | {
      complete: true;
      input: {
        level: number;
        returnTokens?: Record<string, number>;
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
  | ChooseNobleCommandRequest;

export type DiscoveryRequest =
  | TakeThreeDistinctGemsDiscoveryRequest
  | TakeTwoSameGemsDiscoveryRequest
  | ReserveFaceUpCardDiscoveryRequest
  | ReserveDeckCardDiscoveryRequest
  | BuyFaceUpCardDiscoveryRequest
  | BuyReservedCardDiscoveryRequest
  | ChooseNobleDiscoveryRequest;

export type DiscoveryResult =
  | TakeThreeDistinctGemsDiscoveryResult
  | TakeTwoSameGemsDiscoveryResult
  | ReserveFaceUpCardDiscoveryResult
  | ReserveDeckCardDiscoveryResult
  | BuyFaceUpCardDiscoveryResult
  | BuyReservedCardDiscoveryResult
  | ChooseNobleDiscoveryResult;

export type CommandType =
  | "take_three_distinct_gems"
  | "take_two_same_gems"
  | "reserve_face_up_card"
  | "reserve_deck_card"
  | "buy_face_up_card"
  | "buy_reserved_card"
  | "choose_noble";

export type TakeThreeDistinctGemsCommandPayload = Omit<
  TakeThreeDistinctGemsCommandRequest,
  "actorId"
>;

export type TakeThreeDistinctGemsDiscoveryPayload = Omit<
  TakeThreeDistinctGemsDiscoveryRequest,
  "actorId"
>;

export type TakeTwoSameGemsCommandPayload = Omit<
  TakeTwoSameGemsCommandRequest,
  "actorId"
>;

export type TakeTwoSameGemsDiscoveryPayload = Omit<
  TakeTwoSameGemsDiscoveryRequest,
  "actorId"
>;

export type ReserveFaceUpCardCommandPayload = Omit<
  ReserveFaceUpCardCommandRequest,
  "actorId"
>;

export type ReserveFaceUpCardDiscoveryPayload = Omit<
  ReserveFaceUpCardDiscoveryRequest,
  "actorId"
>;

export type ReserveDeckCardCommandPayload = Omit<
  ReserveDeckCardCommandRequest,
  "actorId"
>;

export type ReserveDeckCardDiscoveryPayload = Omit<
  ReserveDeckCardDiscoveryRequest,
  "actorId"
>;

export type BuyFaceUpCardCommandPayload = Omit<
  BuyFaceUpCardCommandRequest,
  "actorId"
>;

export type BuyFaceUpCardDiscoveryPayload = Omit<
  BuyFaceUpCardDiscoveryRequest,
  "actorId"
>;

export type BuyReservedCardCommandPayload = Omit<
  BuyReservedCardCommandRequest,
  "actorId"
>;

export type BuyReservedCardDiscoveryPayload = Omit<
  BuyReservedCardDiscoveryRequest,
  "actorId"
>;

export type ChooseNobleCommandPayload = Omit<
  ChooseNobleCommandRequest,
  "actorId"
>;

export type ChooseNobleDiscoveryPayload = Omit<
  ChooseNobleDiscoveryRequest,
  "actorId"
>;

export type CommandPayload =
  | TakeThreeDistinctGemsCommandPayload
  | TakeTwoSameGemsCommandPayload
  | ReserveFaceUpCardCommandPayload
  | ReserveDeckCardCommandPayload
  | BuyFaceUpCardCommandPayload
  | BuyReservedCardCommandPayload
  | ChooseNobleCommandPayload;

export type DiscoveryPayload =
  | TakeThreeDistinctGemsDiscoveryPayload
  | TakeTwoSameGemsDiscoveryPayload
  | ReserveFaceUpCardDiscoveryPayload
  | ReserveDeckCardDiscoveryPayload
  | BuyFaceUpCardDiscoveryPayload
  | BuyReservedCardDiscoveryPayload
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
    returnTokens?: Record<string, number>;
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
    returnTokens?: Record<string, number>;
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
    returnTokens?: Record<string, number>;
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
    returnTokens?: Record<string, number>;
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
  removeEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void;
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
    request: { gameSessionId: string } & Omit<
      TakeThreeDistinctGemsDiscoveryPayload,
      "type"
    >,
  ): Promise<GameDiscoveryResultMessage>;
  discoverTakeTwoSameGems(
    request: { gameSessionId: string } & Omit<
      TakeTwoSameGemsDiscoveryPayload,
      "type"
    >,
  ): Promise<GameDiscoveryResultMessage>;
  discoverReserveFaceUpCard(
    request: { gameSessionId: string } & Omit<
      ReserveFaceUpCardDiscoveryPayload,
      "type"
    >,
  ): Promise<GameDiscoveryResultMessage>;
  discoverReserveDeckCard(
    request: { gameSessionId: string } & Omit<
      ReserveDeckCardDiscoveryPayload,
      "type"
    >,
  ): Promise<GameDiscoveryResultMessage>;
  discoverBuyFaceUpCard(
    request: { gameSessionId: string } & Omit<
      BuyFaceUpCardDiscoveryPayload,
      "type"
    >,
  ): Promise<GameDiscoveryResultMessage>;
  discoverBuyReservedCard(
    request: { gameSessionId: string } & Omit<
      BuyReservedCardDiscoveryPayload,
      "type"
    >,
  ): Promise<GameDiscoveryResultMessage>;
  discoverChooseNoble(
    request: { gameSessionId: string } & Omit<
      ChooseNobleDiscoveryPayload,
      "type"
    >,
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

  socket.addEventListener("message", handleMessage);

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
      request: { gameSessionId: string } & Omit<
        TakeThreeDistinctGemsDiscoveryPayload,
        "type"
      >,
    ) {
      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery: {
          type: "take_three_distinct_gems",
          step: request.step,
          input: request.input,
        },
      });
    },
    discoverTakeTwoSameGems(
      request: { gameSessionId: string } & Omit<
        TakeTwoSameGemsDiscoveryPayload,
        "type"
      >,
    ) {
      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery: {
          type: "take_two_same_gems",
          step: request.step,
          input: request.input,
        },
      });
    },
    discoverReserveFaceUpCard(
      request: { gameSessionId: string } & Omit<
        ReserveFaceUpCardDiscoveryPayload,
        "type"
      >,
    ) {
      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery: {
          type: "reserve_face_up_card",
          step: request.step,
          input: request.input,
        },
      });
    },
    discoverReserveDeckCard(
      request: { gameSessionId: string } & Omit<
        ReserveDeckCardDiscoveryPayload,
        "type"
      >,
    ) {
      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery: {
          type: "reserve_deck_card",
          step: request.step,
          input: request.input,
        },
      });
    },
    discoverBuyFaceUpCard(
      request: { gameSessionId: string } & Omit<
        BuyFaceUpCardDiscoveryPayload,
        "type"
      >,
    ) {
      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery: {
          type: "buy_face_up_card",
          step: request.step,
          input: request.input,
        },
      });
    },
    discoverBuyReservedCard(
      request: { gameSessionId: string } & Omit<
        BuyReservedCardDiscoveryPayload,
        "type"
      >,
    ) {
      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery: {
          type: "buy_reserved_card",
          step: request.step,
          input: request.input,
        },
      });
    },
    discoverChooseNoble(
      request: { gameSessionId: string } & Omit<
        ChooseNobleDiscoveryPayload,
        "type"
      >,
    ) {
      return this.discover({
        gameSessionId: request.gameSessionId,
        discovery: {
          type: "choose_noble",
          step: request.step,
          input: request.input,
        },
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
      gameSnapshotListeners.clear();
      gameEndedListeners.clear();
      discoveryResultListeners.clear();
      executionResultListeners.clear();
      messageListeners.clear();
    },
  };
}
