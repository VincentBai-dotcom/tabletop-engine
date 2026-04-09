import type { ProgressionState } from "./progression";
import type { RNGState } from "./rng";
import type { GameDefinition } from "../game-definition";
import type { CommandDefinition } from "./command";

export interface HistoryEntry {
  id: string;
  commandType: string;
  actorId?: string;
}

export interface HistoryState {
  entries: HistoryEntry[];
}

export interface RuntimeState {
  progression: ProgressionState;
  rng: RNGState;
  history: HistoryState;
}

export interface CanonicalState<
  GameState extends object = object,
  Runtime extends RuntimeState = RuntimeState,
> {
  game: GameState;
  runtime: Runtime;
}

type NonFunctionPropertyKeys<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => unknown ? never : K;
}[keyof T];

export type CanonicalDataFromFacade<TFacade> =
  TFacade extends readonly (infer TItem)[]
    ? CanonicalDataFromFacade<TItem>[]
    : TFacade extends object
      ? {
          [K in NonFunctionPropertyKeys<TFacade>]: CanonicalDataFromFacade<
            TFacade[K]
          >;
        }
      : TFacade;

export type CanonicalGameStateOf<TGame> =
  TGame extends GameDefinition<
    infer TCanonicalGameState extends object,
    infer TFacadeGameState extends object,
    infer TCommands extends Record<string, CommandDefinition>
  >
    ? TCanonicalGameState &
        Pick<TFacadeGameState, never> &
        Pick<TCommands, never>
    : never;

export type CanonicalStateOf<TGame> = CanonicalState<
  CanonicalGameStateOf<TGame>
>;
