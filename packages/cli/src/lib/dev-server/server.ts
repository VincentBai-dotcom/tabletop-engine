import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AnyGameDefinition, GameEvent } from "@tableverse-kit/engine";
import {
  DevSession,
  type CommandRequest,
  type DiscoveryRequest,
} from "./session.ts";

export interface DevServerOptions {
  port?: number;
}

export interface DevServerHandle {
  port: number;
  url: string;
  close(): Promise<void>;
}

interface Connection {
  viewer: string;
  res: ServerResponse;
}

export async function startDevServer(
  game: AnyGameDefinition,
  options: DevServerOptions = {},
): Promise<DevServerHandle> {
  const session = new DevSession(game);
  const connections = new Set<Connection>();

  const broadcastSnapshots = (): void => {
    for (const connection of connections) {
      writeEvent(
        connection.res,
        "snapshot",
        session.snapshotFor(connection.viewer),
      );
    }
  };

  const broadcastEvents = (events: GameEvent[]): void => {
    for (const event of events) {
      for (const connection of connections) {
        writeEvent(connection.res, "event", event);
      }
    }
  };

  const openStream = (res: ServerResponse, viewer: string): void => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });
    res.write("\n");
    const connection: Connection = { viewer, res };
    connections.add(connection);
    if (session.initialized) {
      writeEvent(res, "snapshot", session.snapshotFor(viewer));
    }
    const drop = () => connections.delete(connection);
    res.on("close", drop);
    res.on("error", drop);
  };

  const handleRequest = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    setCors(res);
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", "http://localhost");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (method === "POST" && url.pathname === "/initialize") {
      const body = (await readJson(req)) as {
        setupInput?: unknown;
        players?: string[];
        seed?: string | number;
      };
      session.initialize({
        setup: body.setupInput,
        players: body.players,
        seed: body.seed,
      });
      broadcastSnapshots();
      sendJson(res, 200, { version: session.version });
      return;
    }

    if (method === "GET" && url.pathname === "/session") {
      openStream(res, viewerFrom(url));
      return;
    }

    if (!session.initialized) {
      sendJson(res, 409, { error: "not_initialized" });
      return;
    }

    if (method === "POST" && url.pathname === "/execute") {
      const body = (await readJson(req)) as {
        viewer: string;
        command: CommandRequest;
      };
      const outcome = session.execute(body.viewer, body.command);
      sendJson(res, 200, outcome.result);
      if (outcome.result.accepted) {
        broadcastSnapshots();
        broadcastEvents(outcome.events);
      }
      return;
    }

    if (method === "POST" && url.pathname === "/discover") {
      const body = (await readJson(req)) as {
        viewer: string;
        request: DiscoveryRequest;
      };
      sendJson(res, 200, session.discover(body.viewer, body.request));
      return;
    }

    if (method === "GET" && url.pathname === "/commands") {
      sendJson(res, 200, session.availableCommands(viewerFrom(url)));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };

  const server = createServer((req, res) => {
    void handleRequest(req, res).catch(() => {
      sendJson(res, 500, { error: "internal_error" });
    });
  });

  const port = await listen(server, options.port ?? 5100);
  return {
    port,
    url: `http://localhost:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const connection of connections) {
          connection.res.end();
        }
        server.close(() => resolve());
      }),
  };
}

function viewerFrom(url: URL): string {
  return url.searchParams.get("viewer") ?? "p1";
}

function writeEvent(res: ServerResponse, name: string, data: unknown): void {
  if (res.writableEnded) {
    return;
  }
  try {
    res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Stream closed between the guard and the write; the connection's close /
    // error handler removes it from the broadcast set.
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) {
    return;
  }
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
}

function setCors(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? JSON.parse(raw) : {};
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolve(address.port);
      } else {
        reject(new Error("dev_server_no_address"));
      }
    });
  });
}
