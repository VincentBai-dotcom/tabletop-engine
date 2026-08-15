export type ConnectionStatus =
  | "connecting"
  | "ready"
  | "reconnecting"
  | "closed"
  | "error";

export type TransportErrorReason =
  | "not_ready"
  | "connection_lost"
  | "server_error"
  | "closed";

const DEFAULT_MESSAGE: Record<TransportErrorReason, string> = {
  not_ready: "client is not ready",
  connection_lost: "connection lost",
  server_error: "server error",
  closed: "client is closed",
};

export class TransportError extends Error {
  readonly reason: TransportErrorReason;

  constructor(reason: TransportErrorReason, message?: string) {
    super(message ?? DEFAULT_MESSAGE[reason]);
    this.name = "TransportError";
    this.reason = reason;
  }
}
