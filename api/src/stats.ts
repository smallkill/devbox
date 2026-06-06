// Analytics Engine 查詢走 Cloudflare SQL API(HTTP),非 D1。
// 此函式只組裝 SQL 字串;實際送出在部署後接 account API token(見 Phase 6)。
export function buildStatsQuery(dataset: string): string {
  return `
    SELECT blob1 AS slug, count() AS clicks
    FROM ${dataset}
    WHERE timestamp > now() - INTERVAL '24' HOUR
    GROUP BY slug
    ORDER BY clicks DESC
    LIMIT 10
  `.trim();
}
