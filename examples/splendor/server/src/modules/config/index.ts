import type { ServerConfig, ServerEnvironment } from "./model";

const DEFAULT_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/splendor";
const DEFAULT_WEB_ORIGIN = "http://localhost:5173";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    env: readEnvironment(env.NODE_ENV),
    server: {
      host: env.HOST || "127.0.0.1",
      port: readPort(env.PORT),
    },
    database: {
      url: env.POSTGRES_URL || env.POSTGRES_URL_LOCAL || DEFAULT_DATABASE_URL,
    },
    web: {
      origin: env.WEB_ORIGIN || DEFAULT_WEB_ORIGIN,
    },
  };
}

function readEnvironment(value: string | undefined): ServerEnvironment {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
}

function readPort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("invalid_server_port");
  }

  return port;
}

export const config = {
  get() {
    return loadConfig();
  },
  get isDevelopment() {
    return loadConfig().env === "development";
  },
  get isProduction() {
    return loadConfig().env === "production";
  },
};

export type { ServerConfig, ServerEnvironment } from "./model";
