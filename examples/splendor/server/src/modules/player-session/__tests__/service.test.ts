import { describe, expect, it } from "bun:test";
import { createPlayerSessionService, hashPlayerSessionToken } from "../service";
import type { PlayerSessionRecord, PlayerSessionStore } from "../model";

function createFakeStore() {
  const records = new Map<string, PlayerSessionRecord>();
  const touched: Array<{ id: string; now: Date }> = [];
  let nextId = 1;

  const store: PlayerSessionStore = {
    async findByTokenHash(tokenHash) {
      return records.get(tokenHash) ?? null;
    },
    async insert({ tokenHash, now }) {
      const record: PlayerSessionRecord = {
        id: `session-${nextId++}`,
        tokenHash,
        createdAt: now,
        lastSeenAt: now,
      };
      records.set(tokenHash, record);
      return record;
    },
    async touch({ id, now }) {
      touched.push({ id, now });
      for (const record of records.values()) {
        if (record.id === id) {
          record.lastSeenAt = now;
          return;
        }
      }
    },
  };

  return { records, store, touched };
}

describe("createPlayerSessionService", () => {
  it("creates a new player session when no token is provided", async () => {
    const fake = createFakeStore();
    const now = new Date("2026-04-19T12:00:00.000Z");
    const service = createPlayerSessionService({
      store: fake.store,
      clock: { now: () => now },
      tokenGenerator: () => "raw-token-1",
    });

    const result = await service.resolveOrCreatePlayerSession({ token: null });

    expect(result).toEqual({
      playerSessionId: "session-1",
      token: "raw-token-1",
      tokenWasCreated: true,
    });
  });

  it("updates last seen and reuses a known token", async () => {
    const fake = createFakeStore();
    const firstNow = new Date("2026-04-19T12:00:00.000Z");
    const secondNow = new Date("2026-04-19T12:05:00.000Z");
    let currentNow = firstNow;
    const service = createPlayerSessionService({
      store: fake.store,
      clock: { now: () => currentNow },
      tokenGenerator: () => "raw-token-1",
    });

    await service.resolveOrCreatePlayerSession({ token: null });
    currentNow = secondNow;

    const result = await service.resolveOrCreatePlayerSession({
      token: "raw-token-1",
    });

    expect(result).toEqual({
      playerSessionId: "session-1",
      token: "raw-token-1",
      tokenWasCreated: false,
    });
    expect(fake.touched).toEqual([{ id: "session-1", now: secondNow }]);
  });

  it("creates a fresh session when the provided token is unknown", async () => {
    const fake = createFakeStore();
    const service = createPlayerSessionService({
      store: fake.store,
      clock: { now: () => new Date("2026-04-19T12:00:00.000Z") },
      tokenGenerator: () => "replacement-token",
    });

    const result = await service.resolveOrCreatePlayerSession({
      token: "unknown-token",
    });

    expect(result).toEqual({
      playerSessionId: "session-1",
      token: "replacement-token",
      tokenWasCreated: true,
    });
  });

  it("stores a token hash instead of the raw token", async () => {
    const fake = createFakeStore();
    const service = createPlayerSessionService({
      store: fake.store,
      clock: { now: () => new Date("2026-04-19T12:00:00.000Z") },
      tokenGenerator: () => "raw-token-1",
    });

    await service.resolveOrCreatePlayerSession({ token: undefined });

    const [storedRecord] = [...fake.records.values()];
    expect(storedRecord?.tokenHash).toBe(hashPlayerSessionToken("raw-token-1"));
    expect(storedRecord?.tokenHash).not.toBe("raw-token-1");
  });
});
