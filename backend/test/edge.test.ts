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