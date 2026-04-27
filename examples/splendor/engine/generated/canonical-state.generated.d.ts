export interface CanonicalState {
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
        reservedCardIds: number[];
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
      deckByLevel: Record<string, number[]>;
      nobleIds: number[];
    };
    endGame?: {
      triggeredByPlayerId: string;
      endsAfterPlayerId: string;
    };
    winnerIds?: string[];
  };
  runtime: {
    progression: {
      currentStage:
        | {
            id: "playerTurn";
            kind: "activePlayer";
            activePlayerId: string;
          }
        | {
            id: "returnExcessiveTokens";
            kind: "activePlayer";
            activePlayerId: string;
          }
        | {
            id: "checkVictoryCondition";
            kind: "automatic";
          }
        | {
            id: "gameEnd";
            kind: "automatic";
          }
        | {
            id: "resolveNoble";
            kind: "automatic";
          }
        | {
            id: "chooseNoble";
            kind: "activePlayer";
            activePlayerId: string;
          };
      lastActingStage:
        | {
            id: "playerTurn";
            kind: "activePlayer";
            activePlayerId: string;
          }
        | {
            id: "returnExcessiveTokens";
            kind: "activePlayer";
            activePlayerId: string;
          }
        | {
            id: "chooseNoble";
            kind: "activePlayer";
            activePlayerId: string;
          }
        | null;
    };
    rng: {
      seed: string | number;
      cursor: number;
    };
    history: {
      entries: {
        id: string;
        commandType: string;
        actorId?: string;
      }[];
    };
  };
}
