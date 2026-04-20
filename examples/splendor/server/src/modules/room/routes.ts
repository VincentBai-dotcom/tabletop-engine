import { Elysia, t } from "elysia";
import type { RoomService } from "./index";

export interface RoomRoutesDeps {
  roomService: RoomService;
}

const createRoomBody = t.Object({
  displayName: t.String({ minLength: 1 }),
  playerSessionToken: t.Optional(t.String()),
});

const joinRoomBody = t.Object({
  roomCode: t.String({ minLength: 1 }),
  displayName: t.String({ minLength: 1 }),
  playerSessionToken: t.Optional(t.String()),
});

export function createRoomRoutes({ roomService }: RoomRoutesDeps) {
  return new Elysia({ prefix: "/rooms" })
    .post(
      "",
      async ({ body }) =>
        roomService.createRoom({
          displayName: body.displayName,
          token: body.playerSessionToken,
        }),
      {
        body: createRoomBody,
        detail: {
          summary: "Create a new room",
          tags: ["rooms"],
        },
      },
    )
    .post(
      "/join",
      async ({ body }) =>
        roomService.joinRoom({
          roomCode: body.roomCode,
          displayName: body.displayName,
          token: body.playerSessionToken,
        }),
      {
        body: joinRoomBody,
        detail: {
          summary: "Join an existing room",
          tags: ["rooms"],
        },
      },
    );
}
