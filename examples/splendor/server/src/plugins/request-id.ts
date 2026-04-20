import { Elysia } from "elysia";
import { createRandomToken } from "../lib/random";

export const requestId = new Elysia({ name: "request-id" }).derive(
  ({ request, set }) => {
    const existingRequestId = request.headers.get("x-request-id");
    const id = existingRequestId || createRandomToken();
    set.headers["x-request-id"] = id;
    return {
      requestId: id,
    };
  },
);
