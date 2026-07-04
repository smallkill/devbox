import { describe, it, expect, vi, afterEach } from "vitest";
import { buildMetricsQuery, parseRows, fetchMetrics } from "../src/metrics";
import { shouldAlert } from "../src/index";

afterEach(() => vi.unstubAllGlobals());

describe("buildMetricsQuery", () => {
  it("產生查近 30 分鐘 error rate / p95 的 SQL", () => {
    const sql = buildMetricsQuery("devbox_requests");
    expect(sql).toContain("devbox_requests");
    expect(sql).toContain("30");
    expect(sql.toLowerCase()).toContain("quantile(0.95)");
    expect(sql).not.toContain("GROUP BY");
  });

  it("只把 5xx 算作錯誤(非 4xx)", () => {
    const sql = buildMetricsQuery("devbox_requests");
    expect(sql).toContain(">= 500");
    expect(sql).not.toMatch(/>=\s*400/);
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
