import { describe, it, expect } from "vitest";
import { makeApp, TEST_ENV } from "./helpers.js";
import { loadConfig } from "../src/config.js";
import { signToken, verifyToken } from "../src/modules/portfolio/token.js";

const H = { "x-internal-key": TEST_ENV.INTERNAL_API_KEY };
const body = {
  learnerId: "3b241101-e2bb-4255-8caf-4136c566a962", capstoneId: "stage3-capstone", displayName: "Thandi M.",
  skills: [{ skill: "Excel formulas", level: "intermediate", evidence: "VLOOKUP + pivot capstone" }],
};

describe("config guardrails", () => {
  it("refuses to boot without a signing key (no hardcoded fallback)", () => {
    const { PORTFOLIO_SIGNING_KEY, ...rest } = TEST_ENV;
    expect(() => loadConfig(rest as NodeJS.ProcessEnv)).toThrow(/PORTFOLIO_SIGNING_KEY/);
  });
  it("refuses a weak signing key", () => {
    expect(() => loadConfig({ ...TEST_ENV, PORTFOLIO_SIGNING_KEY: "short" } as NodeJS.ProcessEnv)).toThrow();
  });
});

describe("portfolio", () => {
  it("completing a capstone returns a unique, verifiable link; repeat is idempotent", async () => {
    const { app } = await makeApp();
    const r1 = await app.inject({ method: "POST", url: "/v1/capstones/complete", headers: H, payload: body });
    expect(r1.statusCode).toBe(201);
    const again = await app.inject({ method: "POST", url: "/v1/capstones/complete", headers: H, payload: body });
    expect(again.json().portfolioUrl).toBe(r1.json().portfolioUrl);
    const other = await app.inject({ method: "POST", url: "/v1/capstones/complete", headers: H,
      payload: { ...body, learnerId: "11111111-1111-4111-8111-111111111111" } });
    expect(other.json().portfolioUrl).not.toBe(r1.json().portfolioUrl);
  });

  it("requires the internal key", async () => {
    const { app } = await makeApp();
    const r = await app.inject({ method: "POST", url: "/v1/capstones/complete", payload: body });
    expect(r.statusCode).toBe(401);
  });

  it("verification shows verified skills and NO PII / internal ids", async () => {
    const { app } = await makeApp();
    const r = await app.inject({ method: "POST", url: "/v1/capstones/complete", headers: H, payload: body });
    const token = r.json().verifyUrl.split("/").pop();
    const v = await app.inject({ method: "GET", url: `/v1/verify/${token}` });
    expect(v.statusCode).toBe(200);
    const j = v.json();
    expect(j.verified).toBe(true);
    expect(j.skills[0].skill).toBe("Excel formulas");
    expect(JSON.stringify(j)).not.toContain(body.learnerId);
    expect(Object.keys(j)).not.toContain("learnerId");
  });

  it("rejects tampered tokens and tokens signed with another key", async () => {
    const { app } = await makeApp();
    const r = await app.inject({ method: "POST", url: "/v1/capstones/complete", headers: H, payload: body });
    const token: string = r.json().verifyUrl.split("/").pop();
    const [v, , sig] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ pid: "anything", iat: 1 })).toString("base64url");
    expect((await app.inject({ method: "GET", url: `/v1/verify/${v}.${forgedBody}.${sig}` })).statusCode).toBe(404);
    const foreign = signToken({ pid: "x", iat: 1 }, "another-key-another-key-another-key-123456");
    expect((await app.inject({ method: "GET", url: `/v1/verify/${foreign}` })).statusCode).toBe(404);
  });

  it("supports key rotation and revocation", async () => {
    const oldKey = TEST_ENV.PORTFOLIO_SIGNING_KEY;
    const t = signToken({ pid: "p", iat: 1 }, oldKey);
    expect(verifyToken(t, ["new-key-new-key-new-key-new-key-123456", oldKey]).ok).toBe(true);
    expect(verifyToken(t, ["new-key-new-key-new-key-new-key-123456"]).ok).toBe(false);

    const { app } = await makeApp();
    const r = await app.inject({ method: "POST", url: "/v1/capstones/complete", headers: H, payload: body });
    const token = r.json().verifyUrl.split("/").pop();
    const pid = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).pid;
    await app.inject({ method: "POST", url: `/v1/portfolios/${pid}/revoke`, headers: H });
    expect((await app.inject({ method: "GET", url: `/v1/verify/${token}` })).statusCode).toBe(410);
  });
});
