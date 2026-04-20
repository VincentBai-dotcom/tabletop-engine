import { describe, expect, it } from "bun:test";
import { AppError, toErrorResponse } from "../index";

describe("AppError", () => {
  it("carries a stable code, status, message, and optional details", () => {
    const error = new AppError("room_not_found", 404, "Room not found", {
      roomCode: "ABCD12",
    });

    expect(error.code).toBe("room_not_found");
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Room not found");
    expect(error.details).toEqual({ roomCode: "ABCD12" });
  });

  it("serializes expected application errors", () => {
    const response = toErrorResponse(
      new AppError("room_full", 409, "Room is full"),
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "room_full",
        message: "Room is full",
      },
    });
  });

  it("serializes unknown errors as internal server errors", () => {
    const response = toErrorResponse(new Error("database exploded"));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "internal_server_error",
        message: "Internal server error",
      },
    });
  });
});
