import { Elysia } from "elysia";
import { toErrorResponse } from "../modules/errors";

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  ({ error, set }) => {
    const response = toErrorResponse(error);
    set.status = response.statusCode;
    return response.body;
  },
);
