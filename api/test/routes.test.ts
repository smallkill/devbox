import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS links (slug TEXT PRIMARY KEY, url TEXT NOT NULL, created_at INTEGER NOT NULL)",
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
  it("回傳連結總數 JSON", async () => {
    const res = await SELF.fetch("https://x/api/stats");
    expect(res.status).toBe(200);
    const body = await res.json<{ links: number }>();
    expect(typeof body.links).toBe("number");
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
