import type {
  CreateRoomResult,
  JoinRoomResult,
} from "splendor-server/client-types";
import { splendorServerHttpUrl } from "../config";

export async function createRoom(input: {
  displayName: string;
  playerSessionToken: string | null;
}): Promise<CreateRoomResult> {
  const response = await fetch(`${splendorServerHttpUrl}/rooms`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      displayName: input.displayName,
      playerSessionToken: input.playerSessionToken ?? undefined,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    throw new Error(payload.error?.message ?? "Failed to create room");
  }

  return (await response.json()) as CreateRoomResult;
}

export async function joinRoom(input: {
  displayName: string;
  roomCode: string;
  playerSessionToken: string | null;
}): Promise<JoinRoomResult> {
  const response = await fetch(`${splendorServerHttpUrl}/rooms/join`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      displayName: input.displayName,
      roomCode: input.roomCode,
      playerSessionToken: input.playerSessionToken ?? undefined,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    throw new Error(payload.error?.message ?? "Failed to join room");
  }

  return (await response.json()) as JoinRoomResult;
}
