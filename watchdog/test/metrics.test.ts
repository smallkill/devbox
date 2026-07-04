import { describe, it, expect, vi, afterEach } from "vitest";
import { buildMetricsQuery, parseRows, fetchMetrics } from "../src/metrics";
import { shouldAlert } from "../src/index";

afterEach(() => vi.unstubAllGlobals());

describe("buildMetricsQuery", () => {
  it("產生查近 30 分鐘 error rate / p95 的 SQL", () => {
    const sql = buildMetricsQuery("devbox_requests");
    expect(sql).toContain("devbox_requests");
    expect(sql).toContain("30");
    expect(sql).not.toContain("GROUP BY");
  });

  it("只把 5xx 算作錯誤(非 4xx)", () => {
    const sql = buildMetricsQuery("devbox_requests");
    expect(sql).toContain(">= 500");
    expect(sql).not.toMatch(/>=\s*400/);
  });

  // AE SQL 方言沒有 CASE WHEN、也沒有無參數的 quantile()——這兩個是原本會讓查詢
  // 被 API 直接拒絕(400)的語法錯誤(code review 抓到的問題)。鎖死用的是官方文件
  // 確認過的函式:quantileExactWeighted、sumIf、sum(見
  // developers.cloudflare.com/analytics/analytics-engine/sql-reference/aggregate-functions/)。
  it("不使用 AE SQL 不支援的 CASE WHEN / 無參數 quantile()", () => {
    const sql = buildMetricsQuery("devbox_requests");
    expect(sql.toUpperCase()).not.toContain("CASE WHEN");
    // 舊語法錯誤是 `quantile(0.95)(double2)`——不是合法函式,AE 會直接拒絕查詢。
    expect(sql).not.toContain("quantile(0.95)(double2)");
  });

  it("p95 用 quantileExactWeighted 依 _sample_interval 加權", () => {
    const sql = buildMetricsQuery("devbox_requests");
    expect(sql).toContain("quantileExactWeighted(0.95)(double2, _sample_interval)");
  });

  it("errors / total 都依 _sample_interval 加權,而非用 COUNT(*)(抽樣啟動後才準)", () => {
    const sql = buildMetricsQuery("devbox_requests");
    expect(sql).toContain("sumIf(_sample_interval, double1 >= 500)");
    expect(sql).toContain("sum(_sample_interval) AS total");
    expect(sql).not.toMatch(/COUNT\(\*\)/i);
  });
});

describe("parseRows", () => {
  it("取出 data 陣列", () => {
    expect(parseRows({ data: [{ p95: 100, errors: 1, total: 10 }] })).toEqual([
      { p95: 100, errors: 1, total: 10 },
    ]);
  });
  it("格式不符回空陣列", () => {
    expect(parseRows(null)).toEqual([]);
    expect(parseRows({})).toEqual([]);
    expect(parseRows("oops")).toEqual([]);
  });
});

describe("fetchMetrics", () => {
  it("未設 token/account 回安全值(不發 HTTP)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const m = await fetchMetrics({}, "devbox_requests");
    expect(m).toEqual({ errorRate: 0, p95ms: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("正常回應算出 errorRate 與 p95ms", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ p95: 250, errors: 5, total: 100 }] }),
          { status: 200 },
        ),
      ),
    );
    const m = await fetchMetrics(
      { CF_ACCOUNT_ID: "a", AE_API_TOKEN: "t" },
      "devbox_requests",
    );
    expect(m).toEqual({ errorRate: 0.05, p95ms: 250 });
  });

  it("total=0(無流量)回安全值,不當成錯誤", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ p95: 0, errors: 0, total: 0 }] }), {
          status: 200,
        }),
      ),
    );
    const m = await fetchMetrics(
      { CF_ACCOUNT_ID: "a", AE_API_TOKEN: "t" },
      "devbox_requests",
    );
    expect(m).toEqual({ errorRate: 0, p95ms: 0 });
  });

  it("fetch 拋錯回安全值,不 throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const m = await fetchMetrics(
      { CF_ACCOUNT_ID: "a", AE_API_TOKEN: "t" },
      "devbox_requests",
    );
    expect(m).toEqual({ errorRate: 0, p95ms: 0 });
  });

  it("非 2xx 回安全值", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 500 })),
    );
    const m = await fetchMetrics(
      { CF_ACCOUNT_ID: "a", AE_API_TOKEN: "t" },
      "devbox_requests",
    );
    expect(m).toEqual({ errorRate: 0, p95ms: 0 });
  });

  it("回應解析不出數字回安全值", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ p95: "oops" }] }), {
          status: 200,
        }),
      ),
    );
    const m = await fetchMetrics(
      { CF_ACCOUNT_ID: "a", AE_API_TOKEN: "t" },
      "devbox_requests",
    );
    expect(m).toEqual({ errorRate: 0, p95ms: 0 });
  });

  it("安全值不誤觸 shouldAlert", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const m = await fetchMetrics(
      { CF_ACCOUNT_ID: "a", AE_API_TOKEN: "t" },
      "devbox_requests",
    );
    expect(shouldAlert(m)).toBe(false);
  });
});
