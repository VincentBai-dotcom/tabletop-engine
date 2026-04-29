import { describe, expect, it } from "bun:test";
import { loadConfig } from "../index";

describe("loadConfig", () => {
  it("uses development defaults", () => {
    const config = loadConfig({});

    expect(config).toEqual({
      env: "development",
      server: {
        host: "127.0.0.1",
        port: 3000,
      },
      database: {
        url: "postgres://postgres:postgres@localhost:5432/splendor",
      },
      web: {
        origin: "http://localhost:5173",
      },
    });
  });

  it("uses explicit environment overrides", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "4173",
      POSTGRES_URL: "postgres://render.example/prod",
      POSTGRES_URL_LOCAL: "postgres://localhost/ignored",
      WEB_ORIGIN: "https://splendor-web.example",
    });

    expect(config.env).toBe("production");
    expect(config.server).toEqual({
      host: "127.0.0.1",
      port: 4173,
    });
    expect(config.database.url).toBe("postgres://render.example/prod");
    expect(config.web.origin).toBe("https://splendor-web.example");
  });

  it("uses local database url when primary url is absent", () => {
    const config = loadConfig({
      POSTGRES_URL_LOCAL: "postgres://localhost/local",
    });

    expect(config.database.url).toBe("postgres://localhost/local");
  });

  it("uses explicit web origin override", () => {
    const config = loadConfig({
      WEB_ORIGIN: "https://splendor-web.example",
    });

    expect(config.web.origin).toBe("https://splendor-web.example");
  });

  it("rejects invalid ports", () => {
    expect(() => loadConfig({ PORT: "not-a-port" })).toThrow(
      "invalid_server_port",
    );
  });
});
