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
