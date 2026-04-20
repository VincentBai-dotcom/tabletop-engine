import type { Clock } from "../../lib/clock";
import { createRandomToken } from "../../lib/random";
import type {
  PlayerSessionStore,
  ResolvePlayerSessionResult,
  PlayerSessionService,
} from "./model";

interface CreatePlayerSessionServiceDeps {
  store: PlayerSessionStore;
  clock: Clock;
  tokenGenerator?: () => string;
  tokenHasher?: (token: string) => string;
}

export function hashPlayerSessionToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

export function createPlayerSessionService({
  store,
  clock,
  tokenGenerator = createRandomToken,
  tokenHasher = hashPlayerSessionToken,
}: CreatePlayerSessionServiceDeps): PlayerSessionService {
  async function createSession(): Promise<ResolvePlayerSessionResult> {
    const token = tokenGenerator();
    const tokenHash = tokenHasher(token);
    const record = await store.insert({ tokenHash, now: clock.now() });

    return {
      playerSessionId: record.id,
      token,
      tokenWasCreated: true,
    };
  }

  return {
    async resolveOrCreatePlayerSession({ token }) {
      if (!token) {
        return createSession();
      }

      const tokenHash = tokenHasher(token);
      const record = await store.findByTokenHash(tokenHash);
      if (!record) {
        return createSession();
      }

      await store.touch({ id: record.id, now: clock.now() });

      return {
        playerSessionId: record.id,
        token,
        tokenWasCreated: false,
      };
    },
  };
}
