export type ServerEnvironment = "development" | "test" | "production";

export interface ServerConfig {
  env: ServerEnvironment;
  server: {
    host: string;
    port: number;
  };
  database: {
    url: string;
  };
  web: {
    origin: string;
  };
}
