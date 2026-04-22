import type { LiveConnectionRegistry } from "../websocket";

export interface Stoppable {
  stop(): void;
}

export interface ServerStopper {
  stop(): void | Promise<unknown>;
}

export type ExitProcess = (code: number) => void;

export interface ShutdownService {
  handleSigterm(): Promise<void>;
}

export interface CreateShutdownServiceDeps {
  registry: LiveConnectionRegistry;
  heartbeat: Stoppable;
  server: ServerStopper;
  exitProcess: ExitProcess;
  reconnectAfterMs: number;
  closeCode: number;
}
