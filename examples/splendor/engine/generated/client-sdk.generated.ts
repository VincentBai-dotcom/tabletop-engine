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
      options: Array<{
        id: string;
        output: {
          color: string;
          selectedCount: number;
          requiredCount: number;
        };
        nextStep: "select_gem_color" | "select_return_token";
        nextInput:
          | {
              selectedColors?: string[];
              returnTokens?: Record<string, number>;
            }
          | {
              selectedColors: string[];
              returnTokens?: Record<string, number>;
            };
      }>;
    }
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
        nextStep: "select_gem_color" | "select_return_token";
        nextInput:
          | {
              selectedColors?: string[];
              returnTokens?: Record<string, number>;
            }
          | {
              selectedColors: string[];
              returnTokens?: Record<string, number>;
            };
      }>;
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
      options: Array<{
        id: string;
        output: {
          color: string;
          amount: number;
        };
        nextStep: "select_gem_color" | "select_return_token";
        nextInput:
          | {
              selectedColor?: string;
              returnTokens?: Record<string, number>;
            }
          | {
              selectedColor: string;
              returnTokens?: Record<string, number>;
            };
      }>;
    }
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
        nextStep: "select_gem_color" | "select_return_token";
        nextInput:
          | {
              selectedColor?: string;
              returnTokens?: Record<string, number>;
            }
          | {
              selectedColor: string;
              returnTokens?: Record<string, number>;
            };
      }>;
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
      options: Array<{
        id: string;
        output: {
          level: number;
          cardId: number;
          bonusColor: string;
          prestigePoints: number;
          source: string;
        };
        nextStep: "select_face_up_card" | "select_return_token";
        nextInput:
          | {
              selectedLevel?: number;
              selectedCardId?: number;
              returnTokens?: Record<string, number>;
            }
          | {
              selectedLevel: number;
              selectedCardId: number;
              returnTokens?: Record<string, number>;
            };
      }>;
    }
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
        nextStep: "select_face_up_card" | "select_return_token";
        nextInput:
          | {
              selectedLevel?: number;
              selectedCardId?: number;
              returnTokens?: Record<string, number>;
            }
          | {
              selectedLevel: number;
              selectedCardId: number;
              returnTokens?: Record<string, number>;
            };
      }>;
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
      options: Array<{
        id: string;
        output: {
          level: number;
          cardCount: number;
          source: string;
        };
        nextStep: "select_deck_level" | "select_return_token";
        nextInput:
          | {
              selectedLevel?: number;
              returnTokens?: Record<string, number>;
            }
          | {
              selectedLevel: number;
              returnTokens?: Record<string, number>;
            };
      }>;
    }
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
        nextStep: "select_deck_level" | "select_return_token";
        nextInput:
          | {
              selectedLevel?: number;
              returnTokens?: Record<string, number>;
            }
          | {
              selectedLevel: number;
              returnTokens?: Record<string, number>;
            };
      }>;
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

export type TakeThreeDistinctGemsDiscoveryStart = Omit<
  Extract<TakeThreeDistinctGemsDiscoveryRequest, { step: "select_gem_color" }>,
  "actorId"
>;

export const takeThreeDistinctGemsDiscoveryStart = {
  type: "take_three_distinct_gems",
  step: "select_gem_color",
  input: {},
} satisfies TakeThreeDistinctGemsDiscoveryStart;

export type TakeTwoSameGemsDiscoveryStart = Omit<
  Extract<TakeTwoSameGemsDiscoveryRequest, { step: "select_gem_color" }>,
  "actorId"
>;

export const takeTwoSameGemsDiscoveryStart = {
  type: "take_two_same_gems",
  step: "select_gem_color",
  input: {},
} satisfies TakeTwoSameGemsDiscoveryStart;

export type ReserveFaceUpCardDiscoveryStart = Omit<
  Extract<ReserveFaceUpCardDiscoveryRequest, { step: "select_face_up_card" }>,
  "actorId"
>;

export const reserveFaceUpCardDiscoveryStart = {
  type: "reserve_face_up_card",
  step: "select_face_up_card",
  input: {},
} satisfies ReserveFaceUpCardDiscoveryStart;

export type ReserveDeckCardDiscoveryStart = Omit<
  Extract<ReserveDeckCardDiscoveryRequest, { step: "select_deck_level" }>,
  "actorId"
>;

export const reserveDeckCardDiscoveryStart = {
  type: "reserve_deck_card",
  step: "select_deck_level",
  input: {},
} satisfies ReserveDeckCardDiscoveryStart;

export type BuyFaceUpCardDiscoveryStart = Omit<
  Extract<BuyFaceUpCardDiscoveryRequest, { step: "select_face_up_card" }>,
  "actorId"
>;

export const buyFaceUpCardDiscoveryStart = {
  type: "buy_face_up_card",
  step: "select_face_up_card",
  input: {},
} satisfies BuyFaceUpCardDiscoveryStart;

export type BuyReservedCardDiscoveryStart = Omit<
  Extract<BuyReservedCardDiscoveryRequest, { step: "select_reserved_card" }>,
  "actorId"
>;

export const buyReservedCardDiscoveryStart = {
  type: "buy_reserved_card",
  step: "select_reserved_card",
  input: {},
} satisfies BuyReservedCardDiscoveryStart;

export type ChooseNobleDiscoveryStart = Omit<
  Extract<ChooseNobleDiscoveryRequest, { step: "select_noble" }>,
  "actorId"
>;

export const chooseNobleDiscoveryStart = {
  type: "choose_noble",
  step: "select_noble",
  input: {},
} satisfies ChooseNobleDiscoveryStart;
