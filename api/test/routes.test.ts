import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS links (slug TEXT PRIMARY KEY, url TEXT NOT NULL, created_at INTEGER NOT NULL)",
  );
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS visits (ts INTEGER NOT NULL, day TEXT NOT NULL, ip_hash TEXT NOT NULL, country TEXT, path TEXT)",
  );
});

const AUTH = { authorization: "Bearer test-token" };

describe("POST /api/links", () => {
  it("建立短網址回傳 slug", async () => {
    const res = await SELF.fetch("https://x/api/links", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
      headers: { "content-type": "application/json", ...AUTH },
    });
    expect(res.status).toBe(201);
    const body = await res.json<{ slug: string }>();
    expect(body.slug).toMatch(/^[0-9a-zA-Z]{6}$/);
  });

  it("非法 URL 回 400", async () => {
    const res = await SELF.fetch("https://x/api/links", {
      method: "POST",
      body: JSON.stringify({ url: "nope" }),
      headers: { "content-type": "application/json", ...AUTH },
    });
    expect(res.status).toBe(400);
  });

  it("超長 URL 回 400", async () => {
    const longUrl = "https://example.com/" + "a".repeat(2100);
    const res = await SELF.fetch("https://x/api/links", {
      method: "POST",
      body: JSON.stringify({ url: longUrl }),
      headers: { "content-type": "application/json", ...AUTH },
    });
    expect(res.status).toBe(400);
  });

  it("無 token 回 401", async () => {
    const res = await SELF.fetch("https://x/api/links", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/stats", () => {
  it("回傳連結總數 JSON;無 Origin 不帶 ACAO", async () => {
    const res = await SELF.fetch("https://x/api/stats");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(null);
    const body = await res.json<{ links: number }>();
    expect(typeof body.links).toBe("number");
  });
});

describe("GET /api/visit", () => {
  it("埋點回 204;無 Origin 不帶 ACAO", async () => {
    const res = await SELF.fetch("https://x/api/visit?path=/");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(null);
  });
});

describe("CORS allowlist", () => {
  it("允許自家來源與 preview 子網域被 echo,他站/釣魚不帶 ACAO", async () => {
    const ok = await SELF.fetch("https://x/api/stats", {
      headers: { origin: "https://derek-chen.pages.dev" },
    });
    expect(ok.headers.get("access-control-allow-origin")).toBe(
      "https://derek-chen.pages.dev",
    );
    const preview = await SELF.fetch("https://x/api/stats", {
      headers: { origin: "https://abc123.derek-chen.pages.dev" },
    });
    expect(preview.headers.get("access-control-allow-origin")).toBe(
      "https://abc123.derek-chen.pages.dev",
    );
    const evil = await SELF.fetch("https://x/api/stats", {
      headers: { origin: "https://evil.com" },
    });
    expect(evil.headers.get("access-control-allow-origin")).toBe(null);
    const phish = await SELF.fetch("https://x/api/stats", {
      headers: { origin: "https://derek-chen.pages.dev.evil.com" },
    });
    expect(phish.headers.get("access-control-allow-origin")).toBe(null);
    // 非 https scheme 的子網域不可被 echo
    const insecure = await SELF.fetch("https://x/api/stats", {
      headers: { origin: "http://abc.derek-chen.pages.dev" },
    });
    expect(insecure.headers.get("access-control-allow-origin")).toBe(null);
  });
});

describe("GET /api/stats visitors 區塊", () => {
  it("埋點後 visitors 不為 null 且有 views", async () => {
    await SELF.fetch("https://x/api/visit?path=/");
    const res = await SELF.fetch("https://x/api/stats");
    expect(res.status).toBe(200);
    const body = await res.json<{
      visitors: { views: number; topCountries: unknown[] } | null;
    }>();
    expect(body.visitors).not.toBeNull();
    expect(body.visitors!.views).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.visitors!.topCountries)).toBe(true);
  });
});

describe("GET /:slug", () => {
  it("已知 slug 回 302", async () => {
    await env.DB.prepare("INSERT INTO links VALUES (?,?,?)")
      .bind("abc123", "https://example.org", 1)
      .run();
    const res = await SELF.fetch("https://x/abc123", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.org");
  });

  it("未知 slug 回 404", async () => {
    const res = await SELF.fetch("https://x/zzzzzz", { redirect: "manual" });
    expect(res.status).toBe(404);
  });
});
