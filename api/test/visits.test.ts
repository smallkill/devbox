import { env } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  utcDay,
  hashIp,
  recordVisit,
  fetchVisitStats,
} from "../src/visits";

describe("utcDay", () => {
  it("epoch 0 為 1970-01-01", () => {
    expect(utcDay(0)).toBe("1970-01-01");
  });
  it("依 UTC 切日(不受本機時區影響)", () => {
    expect(utcDay(Date.UTC(2026, 5, 8, 23, 59))).toBe("2026-06-08");
  });
});

describe("hashIp", () => {
  it("相同輸入得相同輸出(決定性)", async () => {
    const a = await hashIp("1.2.3.4", "salt", "2026-06-08");
    const b = await hashIp("1.2.3.4", "salt", "2026-06-08");
    expect(a).toBe(b);
  });
  it("不同 ip 得不同輸出", async () => {
    const a = await hashIp("1.2.3.4", "salt", "2026-06-08");
    const b = await hashIp("5.6.7.8", "salt", "2026-06-08");
    expect(a).not.toBe(b);
  });
  it("不同 day 得不同輸出", async () => {
    const a = await hashIp("1.2.3.4", "salt", "2026-06-08");
    const b = await hashIp("1.2.3.4", "salt", "2026-06-09");
    expect(a).not.toBe(b);
  });
  it("輸出為 64 碼小寫 hex 且不含原始 ip", async () => {
    const h = await hashIp("1.2.3.4", "salt", "2026-06-08");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("1.2.3.4");
  });
});

describe("recordVisit / fetchVisitStats (D1)", () => {
  beforeAll(async () => {
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS visits (ts INTEGER NOT NULL, day TEXT NOT NULL, ip_hash TEXT NOT NULL, country TEXT, path TEXT)",
    );
  });

  beforeEach(async () => {
    await env.DB.exec("DELETE FROM visits");
  });

  it("同 ip 打兩次 → views=2、uniqueToday=1", async () => {
    await recordVisit(env, "1.2.3.4", "TW", "/");
    await recordVisit(env, "1.2.3.4", "TW", "/about");
    const stats = await fetchVisitStats(env);
    expect(stats?.views).toBe(2);
    expect(stats?.uniqueToday).toBe(1);
  });

  it("TW/TW/JP → topCountries 排序", async () => {
    await recordVisit(env, "1.1.1.1", "TW", "/");
    await recordVisit(env, "2.2.2.2", "TW", "/");
    await recordVisit(env, "3.3.3.3", "JP", "/");
    const stats = await fetchVisitStats(env);
    expect(stats?.topCountries[0]).toEqual({ country: "TW", n: 2 });
    expect(stats?.topCountries[1]).toEqual({ country: "JP", n: 1 });
  });

  it("country 空字串不進 topCountries 但 views 計入", async () => {
    await recordVisit(env, "1.1.1.1", "", "/");
    await recordVisit(env, "2.2.2.2", "TW", "/");
    const stats = await fetchVisitStats(env);
    expect(stats?.views).toBe(2);
    expect(stats?.topCountries).toEqual([{ country: "TW", n: 1 }]);
  });

  it("daily 依日彙整(views / 不重複)且新到舊排序", async () => {
    // recordVisit 只會用「今天」,故直接 insert 指定 day 來測跨日彙整。
    const ins = (ts: number, day: string, ipHash: string, country: string) =>
      env.DB.prepare(
        "INSERT INTO visits (ts, day, ip_hash, country, path) VALUES (?,?,?,?,?)",
      )
        .bind(ts, day, ipHash, country, "/")
        .run();
    await ins(1, "2026-06-10", "h1", "TW");
    await ins(2, "2026-06-10", "h1", "TW"); // 同 ip_hash → 當日 uniques=1
    await ins(3, "2026-06-11", "h2", "JP");
    const daily = (await fetchVisitStats(env))?.daily ?? [];
    expect(daily[0].day).toBe("2026-06-11"); // DESC:新到舊
    expect(daily[1]).toEqual({ day: "2026-06-10", views: 2, uniques: 1 });
  });
});
