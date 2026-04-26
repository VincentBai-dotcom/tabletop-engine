import { splendorServerHttpUrl } from "../config";
import type {
  BrowserLiveClientMessage,
  BrowserLiveServerMessage,
} from "../types/live";
import { normalizeServerMessage } from "../types/live";

export interface LiveConnectionHandlers {
  onMessage(message: BrowserLiveServerMessage): void;
  onClose(): void;
  onOpen(): void;
  onError(error: unknown): void;
}

export interface LiveConnectionHandle {
  socket: WebSocket;
  close(): void;
  send(message: BrowserLiveClientMessage): void;
}

export function connectLive(
  playerSessionToken: string,
  handlers: LiveConnectionHandlers,
): LiveConnectionHandle {
  const socketUrl = new URL("/live", splendorServerHttpUrl);
  socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
  socketUrl.searchParams.set("playerSessionToken", playerSessionToken);
  const socket = new WebSocket(socketUrl.toString());

  socket.addEventListener("open", () => {
    handlers.onOpen();
  });

  socket.addEventListener("message", (event) => {
    const payload =
      typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    handlers.onMessage(normalizeServerMessage(payload));
  });

  socket.addEventListener("close", () => {
    handlers.onClose();
  });

  socket.addEventListener("error", (event) => {
    handlers.onError(event);
  });

  return {
    socket,
    close() {
      socket.close();
    },
    send(message) {
      socket.send(JSON.stringify(message));
    },
  };
}
