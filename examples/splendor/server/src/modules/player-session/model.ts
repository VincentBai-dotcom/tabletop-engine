/** A persisted player session row. */
export interface PlayerSessionRecord {
  id: string;
  tokenHash: string;
  createdAt: Date;
  lastSeenAt: Date;
}

/**
 * Persistence layer for anonymous player sessions.
 * Sessions are identified by a hashed token stored client-side.
 */
export interface PlayerSessionStore {
  /** Look up a session by its token hash. Returns null if no match. */
  findByTokenHash(tokenHash: string): Promise<PlayerSessionRecord | null>;
  /** Create a new session with the given hashed token. */
  insert(input: { tokenHash: string; now: Date }): Promise<PlayerSessionRecord>;
  /** Update lastSeenAt for an existing session (heartbeat). */
  touch(input: { id: string; now: Date }): Promise<void>;
}

export interface ResolvePlayerSessionInput {
  token?: string | null;
}

export interface ResolvePlayerSessionResult {
  playerSessionId: string;
  token: string;
  tokenWasCreated: boolean;
}

/**
 * Application-level player session service.
 * Resolves an existing player session from a client token, or creates a new one.
 */
export interface PlayerSessionService {
  /** Find the player session matching the given token, or create a fresh session if the token is missing or invalid. */
  resolveOrCreatePlayerSession(
    input: ResolvePlayerSessionInput,
  ): Promise<ResolvePlayerSessionResult>;
}
