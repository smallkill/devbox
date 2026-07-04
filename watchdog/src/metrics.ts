// Analytics Engine 查詢走 Cloudflare SQL API(HTTP),非 binding——bindings 只能寫入
// 自己這支 Worker 掛的 dataset,而 devbox_requests 是 api Worker 寫的,watchdog 只讀,
// 所以跟 api/src/stats.ts 一樣走 HTTP SQL API,不掛 analytics_engine_datasets binding。
// 純函式(query 組裝 + 回應解析)可單元測試;HTTP 在 fetchMetrics 做,失敗回安全值
// (errorRate:0, p95ms:0,不誤觸 shouldAlert)。

export interface Metrics {
  errorRate: number;
  p95ms: number;
}

/**
 * 近 30 分鐘 error rate(5xx/總數,非 4xx)與 p95 延遲,一次查完(同一 FROM/WHERE、
 * 無 GROUP BY,兩個 aggregate 可以放同一個 SELECT)。error rate 故意不在 SQL 裡除,
 * 改回傳 errors/total 兩個原始數,在 fetchMetrics 算,避免 total=0 時 SQL 除以零的
 * NaN/null 序列化不確定性。
 */
export function buildMetricsQuery(dataset: string): string {
  return `
    SELECT
      quantile(0.95)(double2) AS p95,
      SUM(CASE WHEN double1 >= 500 THEN 1 ELSE 0 END) AS errors,
      COUNT(*) AS total
    FROM ${dataset}
    WHERE timestamp > now() - INTERVAL '30' MINUTE
  `.trim();
}

/** 安全取出 AE SQL API 回應的 data 陣列(格式:{ data: [...] })。 */
export function parseRows(json: unknown): Array<Record<string, unknown>> {
  if (
    typeof json === "object" &&
    json !== null &&
    "data" in json &&
    Array.isArray((json as { data: unknown }).data)
  ) {
    return (json as { data: Array<Record<string, unknown>> }).data;
  }
  return [];
}

export interface MetricsEnv {
  CF_ACCOUNT_ID?: string;
  AE_API_TOKEN?: string;
}

async function runQuery(
  env: MetricsEnv,
  sql: string,
): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.AE_API_TOKEN}` },
      body: sql,
      // 逾時 → throw → 落入 fetchMetrics 的 catch → 回安全值,不誤觸告警。
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!res.ok) throw new Error(`AE SQL API ${res.status}`);
  return parseRows(await res.json());
}

/**
 * 查近 30 分鐘 error rate(5xx/總數)與 p95 延遲。未設定 token/account、查詢失敗、
 * 或回應解析不出數字時一律回安全值 {errorRate:0, p95ms:0}(不誤觸 shouldAlert),
 * 並用 console.error 留下原因供 Workers Logs 事後查漏發/誤發。
 */
export async function fetchMetrics(
  env: MetricsEnv,
  dataset: string,
): Promise<Metrics> {
  if (!env.CF_ACCOUNT_ID || !env.AE_API_TOKEN) {
    console.error("fetchMetrics: 缺 CF_ACCOUNT_ID 或 AE_API_TOKEN,回安全值");
    return { errorRate: 0, p95ms: 0 };
  }
  try {
    const rows = await runQuery(env, buildMetricsQuery(dataset));
    const total = Number(rows[0]?.total ?? 0);
    const errors = Number(rows[0]?.errors ?? 0);
    const p95ms = Number(rows[0]?.p95 ?? 0);
    if (!Number.isFinite(total) || !Number.isFinite(errors) || !Number.isFinite(p95ms)) {
      console.error(
        `fetchMetrics: 回應解析不出數字,回安全值(row=${JSON.stringify(rows[0])})`,
      );
      return { errorRate: 0, p95ms: 0 };
    }
    return { errorRate: total > 0 ? errors / total : 0, p95ms };
  } catch (e) {
    console.error(`fetchMetrics: 查詢失敗,回安全值(${e})`);
    return { errorRate: 0, p95ms: 0 };
  }
}
