// Analytics Engine 查詢走 Cloudflare SQL API(HTTP),非 D1。
// 純函式(query 組裝 + 回應解析)可單元測試;HTTP 在 fetchClickStats 做,失敗優雅降級。

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

/** 把一列 {slug, clicks} 正規化(AE 數值欄位回字串)。 */
export function toTopLinks(rows: Array<Record<string, unknown>>): TopLink[] {
  return rows.map((r) => ({
    slug: String(r.slug ?? ""),
    clicks: Number(r.clicks ?? 0),
  }));
}

export interface StatsEnv {
  CF_ACCOUNT_ID?: string;
  AE_API_TOKEN?: string;
}

async function runQuery(
  env: StatsEnv,
  sql: string,
): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.AE_API_TOKEN}` },
      body: sql,
      // 逾時 → throw → 落入 fetchClickStats 的 catch → 回 null 降級,
      // 不讓 AE 不健康時拖垮 /api/stats。
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!res.ok) throw new Error(`AE SQL API ${res.status}`);
  return parseRows(await res.json());
}

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
      runQuery(env, buildTopLinksQuery(dataset)),
      runQuery(env, buildTotalClicksQuery(dataset)),
    ]);
    return {
      clicks24h: Number(totalRows[0]?.clicks ?? 0),
      topLinks: toTopLinks(topRows),
    };
  } catch {
    return null;
  }
}
