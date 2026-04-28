import { describe, expect, it } from "bun:test";
import { AppError, toErrorResponse } from "../index";

describe("AppError", () => {
  it("carries a stable code, status, message, and optional details", () => {
    const error = new AppError("ROOM_NOT_FOUND", 404, "Room not found", {
      roomCode: "ABCD12",
    });

    expect(error.code).toBe("ROOM_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Room not found");
    expect(error.details).toEqual({ roomCode: "ABCD12" });
  });

  it("serializes expected application errors", () => {
    const response = toErrorResponse(
      new AppError("ROOM_FULL", 409, "Room is full"),
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "ROOM_FULL",
        message: "Room is full",
      },
    });
  });

  it("serializes unknown errors as internal server errors", () => {
    const response = toErrorResponse(new Error("database exploded"));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  });
});
