const PLAYER_SESSION_TOKEN_KEY = "splendor:web:player-session-token";
const PRESENCE_TARGET_KEY = "splendor:web:presence-target";

export type PresenceTarget =
  | { kind: "room"; roomId: string }
  | { kind: "game"; gameSessionId: string };

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function loadPlayerSessionToken() {
  return getStorage()?.getItem(PLAYER_SESSION_TOKEN_KEY) ?? null;
}

export function savePlayerSessionToken(token: string) {
  getStorage()?.setItem(PLAYER_SESSION_TOKEN_KEY, token);
}

export function clearPlayerSessionToken() {
  getStorage()?.removeItem(PLAYER_SESSION_TOKEN_KEY);
}

export function loadPresenceTarget(): PresenceTarget | null {
  const raw = getStorage()?.getItem(PRESENCE_TARGET_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PresenceTarget;
    if (
      parsed.kind === "room" &&
      typeof parsed.roomId === "string" &&
      parsed.roomId.length > 0
    ) {
      return parsed;
    }

    if (
      parsed.kind === "game" &&
      typeof parsed.gameSessionId === "string" &&
      parsed.gameSessionId.length > 0
    ) {
      return parsed;
    }
  } catch {
    clearPresenceTarget();
  }

  return null;
}

export function savePresenceTarget(target: PresenceTarget) {
  getStorage()?.setItem(PRESENCE_TARGET_KEY, JSON.stringify(target));
}

export function clearPresenceTarget() {
  getStorage()?.removeItem(PRESENCE_TARGET_KEY);
}
