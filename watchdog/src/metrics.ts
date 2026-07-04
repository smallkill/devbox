// Analytics Engine 查詢走 Cloudflare SQL API(HTTP),非 binding——bindings 只能寫入
// 自己這支 Worker 掛的 dataset,而 devbox_requests 是 api Worker 寫的,watchdog 只讀,
// 所以跟 api/src/stats.ts 一樣走 HTTP SQL API,不掛 analytics_engine_datasets binding。
// HTTP client(parseRows/runQuery)抽到 ../../shared/analytics-engine,兩個 Worker 共用
// 同一份,避免各自維護的 client 行為漂移(code review 抓到的問題)。
// 純函式(query 組裝)可單元測試;HTTP 在 fetchMetrics 做,失敗回安全值
// (errorRate:0, p95ms:0,不誤觸 shouldAlert)。

import {
  parseRows,
  runAnalyticsEngineQuery,
  type AnalyticsEngineEnv,
} from "../../shared/analytics-engine";

export interface Metrics {
  errorRate: number;
  p95ms: number;
  /** 30 分鐘窗內的真實請求數(_sample_interval 加權),供告警端判斷樣本是否足夠。 */
  total: number;
}

/**
 * 近 30 分鐘 error rate(5xx/總數,非 4xx)與 p95 延遲,一次查完(同一 FROM/WHERE、
 * 無 GROUP BY,兩個 aggregate 可以放同一個 SELECT)。
 *
 * AE SQL 方言不支援 CASE WHEN、也沒有無參數的 quantile();確認過的支援函式見
 * https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/
 * (aggregate-functions:count/sum/avg/min/max/quantileExactWeighted/argMax/argMin/
 * topK/countIf/sumIf/avgIf;conditional-functions:if)。
 * - p95 用 quantileExactWeighted(0.95)(double2, _sample_interval):官方範例
 *   `quantileExactWeighted(0.95)(query_time, _sample_interval)` 就是 p95 延遲的寫法。
 * - errors 用 sumIf(_sample_interval, double1 >= 500):sumIf(<sum_expr>, <cond_expr>)
 *   把符合條件的列的 _sample_interval 加總,取代不存在的 CASE WHEN。
 * - total 用 sum(_sample_interval) 而非 COUNT(*):AE 抽樣啟動後一列代表
 *   `_sample_interval` 筆真實請求,COUNT(*) 只算「有留樣的列數」,抽樣一開會低估
 *   分母、讓 error rate / p95 都失真。
 *
 * error rate 故意不在 SQL 裡除,改回傳 errors/total 兩個原始數,在 fetchMetrics 算,
 * 避免 total=0 時 SQL 除以零的 NaN/null 序列化不確定性。
 */
export function buildMetricsQuery(dataset: string): string {
  return `
    SELECT
      quantileExactWeighted(0.95)(double2, _sample_interval) AS p95,
      sumIf(_sample_interval, double1 >= 500) AS errors,
      sum(_sample_interval) AS total
    FROM ${dataset}
    WHERE timestamp > now() - INTERVAL '30' MINUTE
  `.trim();
}

/** 安全取出 AE SQL API 回應的 data 陣列(格式:{ data: [...] })。 */
export { parseRows };

export type MetricsEnv = AnalyticsEngineEnv;

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
    return { errorRate: 0, p95ms: 0, total: 0 };
  }
  try {
    const rows = await runAnalyticsEngineQuery(env, buildMetricsQuery(dataset));
    const total = Number(rows[0]?.total ?? 0);
    const errors = Number(rows[0]?.errors ?? 0);
    const p95ms = Number(rows[0]?.p95 ?? 0);
    if (!Number.isFinite(total) || !Number.isFinite(errors) || !Number.isFinite(p95ms)) {
      console.error(
        `fetchMetrics: 回應解析不出數字,回安全值(row=${JSON.stringify(rows[0])})`,
      );
      return { errorRate: 0, p95ms: 0, total: 0 };
    }
    return { errorRate: total > 0 ? errors / total : 0, p95ms, total };
  } catch (e) {
    console.error(`fetchMetrics: 查詢失敗,回安全值(${e})`);
    return { errorRate: 0, p95ms: 0, total: 0 };
  }
}
