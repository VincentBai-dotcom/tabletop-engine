import type { ProgressionState } from "./progression";
import type { RNGState } from "./rng";

export interface HistoryEntry {
  id: string;
  commandType: string;
  actorId?: string;
}

export interface HistoryState {
  entries: HistoryEntry[];
}

// Host-authoritative init facts, kept distinct from the game's own `setupInput`:
// the platform supplies these, a client cannot. `players` is seating order and is
// opaque to the engine — the host decides what each identity string is.
export interface MatchInit {
  seed: string | number;
  players: string[];
}

export interface RuntimeState {
  progression: ProgressionState;
  rng: RNGState;
  players: string[];
  history: HistoryState;
}

export interface CanonicalState<GameState extends object = object> {
  game: GameState;
  runtime: RuntimeState;
}
