// 共用 Analytics Engine SQL API client。api(stats.ts)與 watchdog(metrics.ts)都需要
// 查詢 Analytics Engine dataset——bindings(analytics_engine_datasets)只能寫入自己
// 掛的 dataset,查詢一律要走 Cloudflare SQL API(HTTP:/accounts/:id/analytics_engine/sql)。
// 兩邊的 request/response 處理完全相同,抽成單一模組避免各自維護的兩份 client 行為漂移
// (見 code review:api/src/stats.ts 與 watchdog/src/metrics.ts 原本是複製貼上的)。

export interface AnalyticsEngineEnv {
  CF_ACCOUNT_ID?: string;
  AE_API_TOKEN?: string;
}

/** 安全取出 AE SQL API 回應的 data 陣列(格式:{ data: [...] }),格式不符回空陣列。 */
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

/**
 * 對 Cloudflare Analytics Engine SQL API 發一次查詢。3 秒逾時(AbortSignal.timeout),
 * 逾時或非 2xx 一律 throw——呼叫端 catch 後各自降級(回安全值或 null),
 * 不讓 AE 不健康拖垮呼叫端的回應。
 */
export async function runAnalyticsEngineQuery(
  env: AnalyticsEngineEnv,
  sql: string,
): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.AE_API_TOKEN}` },
      body: sql,
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!res.ok) throw new Error(`AE SQL API ${res.status}`);
  return parseRows(await res.json());
}
