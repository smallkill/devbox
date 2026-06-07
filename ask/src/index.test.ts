import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

// 為什麼只測 guardrail,不測 happy path:
// vitest-pool-workers 會在「真實」Workers runtime 跑測試,bindings(AI、Vectorize)
// 也是真的 binding。一旦走到問答主流程(env.AI.run embed/LLM、VECTORIZE.query)
// 就會真的打 Cloudflare Workers AI / Vectorize API 並產生用量計費。
// 因此這裡只測「在呼叫 AI/Vectorize 之前就 return」的 guardrail 分支:
//   - 方法/路徑不符 → 404
//   - OPTIONS preflight → CORS header
//   - 問題驗證失敗(空白 / 過長)→ 400
// 這些分支都不會碰到任何 binding。正常問答路徑留待部署後人工驗收。
// (檢核:跑這支測試時若 dashboard 出現 AI/Vectorize 用量,就代表測試走錯分支了。)

const ASK_URL = "https://example.com/api/ask";

describe("/api/ask guardrails", () => {
  it("rejects a whitespace-only question with 400", async () => {
    const res = await SELF.fetch(ASK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: " " }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "empty" });
  });

  it("rejects an over-long question with 400", async () => {
    const res = await SELF.fetch(ASK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "a".repeat(501) }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "too_long" });
  });

  it("returns 404 for GET /api/ask", async () => {
    const res = await SELF.fetch(ASK_URL, { method: "GET" });
    expect(res.status).toBe(404);
  });

  it("answers OPTIONS preflight with CORS headers", async () => {
    const res = await SELF.fetch(ASK_URL, { method: "OPTIONS" });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "content-type",
    );
    expect(res.headers.get("access-control-allow-methods")).toBe(
      "POST, OPTIONS",
    );
  });

  it("rejects an over-large body with 413 (content-length)", async () => {
    const res = await SELF.fetch(ASK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "9000",
      },
      body: JSON.stringify({ question: "a".repeat(9000) }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
  });
});

describe("CORS allowlist", () => {
  it("does not echo a disallowed Origin", async () => {
    const res = await SELF.fetch(ASK_URL, {
      method: "OPTIONS",
      headers: { origin: "https://evil.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    // still returns the static CORS headers
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "content-type",
    );
  });

  it("echoes an allowed pages.dev Origin", async () => {
    const origin = "https://derek-chen.pages.dev";
    const res = await SELF.fetch(ASK_URL, {
      method: "OPTIONS",
      headers: { origin },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
  });

  it("echoes an allowed preview subdomain Origin", async () => {
    const origin = "https://abc123.derek-chen.pages.dev";
    const res = await SELF.fetch(ASK_URL, {
      method: "OPTIONS",
      headers: { origin },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
  });

  it("echoes the allowed Origin on a 400 json response", async () => {
    const origin = "https://derek-chen.pages.dev";
    const res = await SELF.fetch(ASK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ question: " " }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
  });

  it("does not echo a disallowed Origin on a 400 json response", async () => {
    const res = await SELF.fetch(ASK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.com",
      },
      body: JSON.stringify({ question: " " }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
