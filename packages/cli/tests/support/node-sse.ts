import type { SseFactory } from "@tableverse-kit/client/dev";

/**
 * A `fetch`-backed SSE reader for Node test runs, standing in for the browser's
 * native `EventSource` (which needs an experimental flag under Node).
 */
export const nodeSse: SseFactory = (url) => {
  const controller = new AbortController();
  const messageListeners = new Map<string, (data: string) => void>();
  let errorListener: ((reconnecting: boolean) => void) | null = null;

  const dispatch = (frame: string): void => {
    let event = "message";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data = line.slice(5).trim();
      }
    }
    if (data.length > 0) {
      messageListeners.get(event)?.(data);
    }
  };

  const run = async (): Promise<void> => {
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch {
      errorListener?.(false);
      return;
    }
    if (!response.body) {
      errorListener?.(false);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch {
        return;
      }
      if (chunk.done) {
        errorListener?.(false);
        return;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        dispatch(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }
  };

  void run();

  return {
    addMessageListener: (type, listener) =>
      messageListeners.set(type, listener),
    setErrorListener: (listener) => {
      errorListener = listener;
    },
    close: () => controller.abort(),
  };
};
