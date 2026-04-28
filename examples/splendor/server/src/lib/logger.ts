import { resolve } from "node:path";
import pino, { type LoggerOptions } from "pino";
import { config } from "../modules/config";

type LogPayload = Record<string, unknown> | Error | string;

export interface AppLogger {
  child(bindings: Record<string, unknown>): AppLogger;
  debug(payload: LogPayload, message?: string): void;
  info(payload: LogPayload, message?: string): void;
  warn(payload: LogPayload, message?: string): void;
  error(payload: LogPayload, message?: string): void;
}

function createLoggerOptions(overrides: LoggerOptions = {}): LoggerOptions {
  return {
    name: "splendor-server",
    level:
      process.env.LOG_LEVEL ??
      (process.env.NODE_ENV === "production" ? "info" : "debug"),
    redact: {
      paths: [
        "playerSessionToken",
        "*.playerSessionToken",
        "token",
        "*.token",
        "authorization",
        "*.authorization",
        "headers.authorization",
        "*.headers.authorization",
      ],
      censor: "[Redacted]",
    },
    ...overrides,
  };
}

export function createAppLogger(overrides: LoggerOptions = {}): AppLogger {
  const streams: Parameters<typeof pino.multistream>[0] = [
    { stream: process.stdout },
  ];

  if (config.get().env === "development") {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const logFilePath = resolve(
      process.cwd(),
      process.env.LOG_FILE ?? `logs/splendor-server-${dateStamp}.log`,
    );

    streams.push({
      stream: pino.destination({
        dest: logFilePath,
        mkdir: true,
        sync: false,
      }),
    });
  }

  return pino(createLoggerOptions(overrides), pino.multistream(streams));
}

export const rootLogger = createAppLogger();

export function createModuleLogger(moduleName: string): AppLogger {
  return rootLogger.child({ module: moduleName });
}
