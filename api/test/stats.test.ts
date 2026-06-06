import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildTopLinksQuery,
  buildTotalClicksQuery,
  parseRows,
  toTopLinks,
  fetchClickStats,
} from "../src/stats";

afterEach(() => vi.unstubAllGlobals());

describe("buildTopLinksQuery", () => {
  it("產生查近 24h Top 連結的 SQL", () => {
    const sql = buildTopLinksQuery("devbox_clicks");
    expect(sql).toContain("devbox_clicks");
    expect(sql.toLowerCase()).toContain("count");
    expect(sql).toContain("24");
    expect(sql).toContain("LIMIT 10");
  });
});

describe("buildTotalClicksQuery", () => {
  it("產生查近 24h 總點擊的 SQL", () => {
    const sql = buildTotalClicksQuery("devbox_clicks");
    expect(sql).toContain("devbox_clicks");
    expect(sql.toLowerCase()).toContain("count");
    expect(sql).not.toContain("GROUP BY");
  });
});

describe("parseRows", () => {
  it("取出 data 陣列", () => {
    expect(parseRows({ data: [{ slug: "a", clicks: 3 }] })).toEqual([
      { slug: "a", clicks: 3 },
    ]);
  });
  it("格式不符回空陣列", () => {
    expect(parseRows(null)).toEqual([]);
    expect(parseRows({})).toEqual([]);
    expect(parseRows("oops")).toEqual([]);
  });
});

describe("toTopLinks", () => {
  it("把字串數值正規化成 number", () => {
    expect(toTopLinks([{ slug: "abc", clicks: "5" }])).toEqual([
      { slug: "abc", clicks: 5 },
    ]);
  });
  it("缺欄位有預設值", () => {
    expect(toTopLinks([{}])).toEqual([{ slug: "", clicks: 0 }]);
  });
});

describe("fetchClickStats 降級", () => {
  it("未設 token/account 回 null(不發 HTTP)", async () => {
    expect(await fetchClickStats({}, "devbox_clicks")).toBeNull();
  });

  it("fetch 失敗回 null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const r = await fetchClickStats(
      { CF_ACCOUNT_ID: "a", AE_API_TOKEN: "t" },
      "devbox_clicks",
    );
    expect(r).toBeNull();
  });

  it("正常回傳並把字串 count 正規化成 number", async () => {
    const mk = (data: unknown) =>
      new Response(JSON.stringify({ data }), { status: 200 });
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: { body: string }) =>
        Promise.resolve(
          init.body.includes("GROUP BY")
            ? mk([{ slug: "abc", clicks: "3" }])
            : mk([{ clicks: "7" }]),
        ),
      ),
    );
    const r = await fetchClickStats(
      { CF_ACCOUNT_ID: "a", AE_API_TOKEN: "t" },
      "devbox_clicks",
    );
    expect(r).toEqual({ clicks24h: 7, topLinks: [{ slug: "abc", clicks: 3 }] });
  });
});
