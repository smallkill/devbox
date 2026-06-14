// 訪客埋點與彙整。純函式(utcDay / hashIp)可單元測試;D1 存取在 recordVisit / fetchVisitStats。

export function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export async function hashIp(
  ip: string,
  salt: string,
  day: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${salt}|${day}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface CountryCount {
  country: string;
  n: number;
}
export interface DailyCount {
  day: string;
  views: number;
  uniques: number;
}
export interface VisitStats {
  views: number;
  uniqueToday: number;
  topCountries: CountryCount[];
  // 近 N 天每日彙整(新到舊),讓儀表板能看每日歷史而非只有當天。
  daily: DailyCount[];
}
export interface VisitEnv {
  DB: D1Database;
  VISIT_SALT?: string;
}

export async function recordVisit(
  env: VisitEnv,
  ip: string,
  country: string,
  path: string,
): Promise<void> {
  const ts = Date.now();
  const day = utcDay(ts);
  const ipHash = await hashIp(ip, env.VISIT_SALT ?? "", day);
  await env.DB.prepare(
    "INSERT INTO visits (ts, day, ip_hash, country, path) VALUES (?,?,?,?,?)",
  )
    .bind(ts, day, ipHash, country || null, path || null)
    .run();
}

export async function fetchVisitStats(
  env: VisitEnv,
): Promise<VisitStats | null> {
  try {
    const today = utcDay(Date.now());
    const [views, uniq, countries, daily] = await Promise.all([
      env.DB.prepare("SELECT count(*) AS n FROM visits").first<{ n: number }>(),
      env.DB.prepare(
        "SELECT count(DISTINCT ip_hash) AS n FROM visits WHERE day = ?",
      )
        .bind(today)
        .first<{ n: number }>(),
      env.DB.prepare(
        "SELECT country, count(*) AS n FROM visits WHERE country IS NOT NULL AND country != '' GROUP BY country ORDER BY n DESC LIMIT 6",
      ).all<{ country: string; n: number }>(),
      // 每日彙整:每天瀏覽數與不重複訪客,近 14 天(新到舊)。
      env.DB.prepare(
        "SELECT day, count(*) AS views, count(DISTINCT ip_hash) AS uniques FROM visits GROUP BY day ORDER BY day DESC LIMIT 14",
      ).all<{ day: string; views: number; uniques: number }>(),
    ]);
    return {
      views: views?.n ?? 0,
      uniqueToday: uniq?.n ?? 0,
      topCountries: (countries.results ?? []).map((r) => ({
        country: String(r.country),
        n: Number(r.n),
      })),
      daily: (daily.results ?? []).map((r) => ({
        day: String(r.day),
        views: Number(r.views),
        uniques: Number(r.uniques),
      })),
    };
  } catch (e) {
    // 失敗回 null 讓前端降級;留一筆 log 以便排查(visits 表未建 / D1 異常)。
    console.error("fetchVisitStats failed:", e);
    return null;
  }
}
