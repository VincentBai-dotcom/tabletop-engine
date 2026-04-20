import { randomBytes } from "node:crypto";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createRandomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function createRoomCode(length = 6): string {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = randomBytes(1)[0]! % ROOM_CODE_ALPHABET.length;
    code += ROOM_CODE_ALPHABET[randomIndex];
  }

  return code;
}
