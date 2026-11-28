import { describe, it, expect } from "vitest";
import { makeApp } from "./helpers.js";

const hit = (app: any, i: number) =>
  app.inject({ method: "GET", url: "/healthz", headers: { "x-forwarded-for": `10.0.0.${i}` } });

describe("rate limiting cannot be evaded with a spoofed X-Forwarded-For", () => {
  it("ignores X-Forwarded-For when no proxy is configured (default)", async () => {
    const { app } = await makeApp({ globalRatePerMin: 3 });
    const codes: number[] = [];
    for (let i = 1; i <= 5; i++) codes.push((await hit(app, i)).statusCode);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });

  it("honours the header only when a trusted proxy hop is configured", async () => {
    const { app } = await makeApp({ globalRatePerMin: 3, env: { TRUST_PROXY_HOPS: "1" } });
    const codes: number[] = [];
    for (let i = 1; i <= 5; i++) codes.push((await hit(app, i)).statusCode);
    expect(codes).toEqual([200, 200, 200, 200, 200]); // each forwarded client has its own bucket
  });
});

describe("browser boundaries", () => {
  it("rejects wildcard and non-origin CORS configuration", async () => {
    await expect(makeApp({ env: { CORS_ORIGIN: "*" } })).rejects.toThrow(/CORS_ORIGIN/);
    await expect(makeApp({ env: { CORS_ORIGIN: "https://learn.example.test/path" } })).rejects.toThrow(/CORS_ORIGIN/);
    await expect(makeApp({ env: { PUBLIC_BASE_URL: "https://user:pass@api.example.test" } })).rejects.toThrow(/PUBLIC_BASE_URL/);
  });

  it("allows only configured origins and never permits the internal API key header", async () => {
    const { app } = await makeApp({ env: { CORS_ORIGIN: "https://learn.example.test" } });
    const allowed = await app.inject({
      method: "OPTIONS", url: "/v1/grade/typing",
      headers: { origin: "https://learn.example.test", "access-control-request-headers": "content-type" }
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://learn.example.test");
    expect(allowed.headers["access-control-allow-headers"]).toBe("Content-Type");

    const denied = await app.inject({
      method: "OPTIONS", url: "/v1/grade/typing",
      headers: { origin: "https://attacker.example", "access-control-request-headers": "x-internal-key" }
    });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    expect(denied.headers["access-control-allow-headers"]).toBeUndefined();
  });

  it("sends public portfolio links to the configured frontend", async () => {
    const { app } = await makeApp({ env: { FRONTEND_BASE_URL: "https://learn.example.test/app" } });
    const token = "v1.test.token";
    const response = await app.inject({ method: "GET", url: `/p/${token}` });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("https://learn.example.test/app?portfolio=v1.test.token");
  });
});