// Analytics Engine 查詢走 Cloudflare SQL API(HTTP),非 D1。
// HTTP client(parseRows/runQuery)抽到 ../../shared/analytics-engine,跟 watchdog 共用
// 同一份,避免各自維護的 client 行為漂移(code review 抓到的問題)。
// 純函式(query 組裝)可單元測試;HTTP 在 fetchClickStats 做,失敗優雅降級。

import {
  parseRows,
  runAnalyticsEngineQuery,
  type AnalyticsEngineEnv,
} from "../../shared/analytics-engine";

export interface TopLink {
  slug: string;
  clicks: number;
}

export interface ClickStats {
  clicks24h: number;
  topLinks: TopLink[];
}

/** Top 10 連結(近 24h 依點擊排序)。 */
export function buildTopLinksQuery(dataset: string): string {
  return `
    SELECT blob1 AS slug, count() AS clicks
    FROM ${dataset}
    WHERE timestamp > now() - INTERVAL '24' HOUR
    GROUP BY slug
    ORDER BY clicks DESC
    LIMIT 10
  `.trim();
}

/** 近 24h 總點擊。 */
export function buildTotalClicksQuery(dataset: string): string {
  return `
    SELECT count() AS clicks
    FROM ${dataset}
    WHERE timestamp > now() - INTERVAL '24' HOUR
  `.trim();
}

/** 安全取出 AE SQL API 回應的 data 陣列(格式:{ data: [...] })。 */
export { parseRows };

/** 把一列 {slug, clicks} 正規化(AE 數值欄位回字串)。 */
export function toTopLinks(rows: Array<Record<string, unknown>>): TopLink[] {
  return rows.map((r) => ({
    slug: String(r.slug ?? ""),
    clicks: Number(r.clicks ?? 0),
  }));
}

export type StatsEnv = AnalyticsEngineEnv;

/**
 * 查真實點擊指標。未設定 token/account 或查詢失敗時回 null,
 * 讓呼叫端優雅降級(只回連結數,不讓儀表板壞掉)。
 */
export async function fetchClickStats(
  env: StatsEnv,
  dataset: string,
): Promise<ClickStats | null> {
  if (!env.CF_ACCOUNT_ID || !env.AE_API_TOKEN) return null;
  try {
    const [topRows, totalRows] = await Promise.all([
      runAnalyticsEngineQuery(env, buildTopLinksQuery(dataset)),
      runAnalyticsEngineQuery(env, buildTotalClicksQuery(dataset)),
    ]);
    return {
      clicks24h: Number(totalRows[0]?.clicks ?? 0),
      topLinks: toTopLinks(topRows),
    };
  } catch {
    return null;
  }
}
