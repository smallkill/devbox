import { makeSlug, isValidUrl } from "./slug";
import { fetchClickStats } from "./stats";
import { recordVisit, fetchVisitStats } from "./visits";

export interface Env {
  DB: D1Database;
  CLICKS: AnalyticsEngineDataset;
  // 建立短網址所需的 bearer token,用 `wrangler secret put CREATE_TOKEN` 設。
  CREATE_TOKEN: string;
  // Analytics Engine SQL API 用(account id 是 var,token 是 secret)。
  CF_ACCOUNT_ID?: string;
  AE_API_TOKEN?: string;
  // 訪客 IP 雜湊 salt,用 `wrangler secret put VISIT_SALT` 設(防止彩虹表反推原始 IP)。
  VISIT_SALT?: string;
}

const CLICKS_DATASET = "devbox_clicks";

const SLUG_RE = /^\/[0-9a-zA-Z]{6}$/;
const MAX_URL_LEN = 2048;

// /api/stats 邊緣快取設定。
// 同步跑 D1 + 兩個 Analytics Engine SQL fetch 很慢且不穩(0.6s~6s 跳動),
// 前端會誤判 offline。用 Cache API 快取「純資料」120 秒,CORS 每次重套。
const STATS_CACHE_TTL = 120;
// 降級資料(AE/訪客查詢失敗回 null)只短快取,避免一次暫時性故障把
// 「點擊/訪客缺失」的儀表板釘住 2 分鐘;下次請求很快就能撿回復原的後端。
const STATS_CACHE_TTL_DEGRADED = 15;
// 固定內部 cache key——刻意不含真實 Origin,避免不同來源互相汙染快取;
// 也讓 CORS header 不會被存進快取(快取的是資料、不是 CORS)。
const STATS_CACHE_KEY = "https://cache.internal/api-stats";

/**
 * CORS:只 echo 給自家站台(derek-chen.pages.dev,含 preview 子網域)與本機開發,
 * 非允許來源不帶 allow-origin。/api/stats、/api/visit 皆公開唯讀 GET,收斂只是不讓
 * 他站 JS 讀回應、並消掉掃描的 ACAO:* 告警(實際存取無法靠 CORS 擋,本來就能 curl)。
 * echo origin 時帶 Vary: Origin,避免快取把某來源的 ACAO 餵給別的來源。
 * 註:/api/links 是 bearer 鑑權的伺服器端呼叫(CLI / service binding),不走瀏覽器 CORS。
 */
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const h: Record<string, string> = { vary: "Origin" };
  // 單一錨定 regex:限 https、apex 或單層 preview 子網域、子網域字元受限;
  // 加本機開發。錨定 ^…$ 防尾綴釣魚(…pages.dev.evil.com)、明確 pin scheme。
  if (
    /^https:\/\/([a-z0-9-]+\.)?derek-chen\.pages\.dev$/.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
  ) {
    h["access-control-allow-origin"] = origin;
  }
  return h;
}

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // 建立短網址 — 需 bearer 鑑權,擋掉公開濫用(open-redirect 釣魚)。
    if (req.method === "POST" && path === "/api/links") {
      const auth = req.headers.get("authorization");
      // fail-closed:未設 CREATE_TOKEN 或 token 不符一律拒絕。
      if (!env.CREATE_TOKEN || auth !== `Bearer ${env.CREATE_TOKEN}`) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      const { url: target } = await req
        .json<{ url?: string }>()
        .catch(() => ({ url: undefined }));
      if (!target || target.length > MAX_URL_LEN || !isValidUrl(target)) {
        return Response.json({ error: "invalid url" }, { status: 400 });
      }
      const slug = makeSlug();
      await env.DB.prepare(
        "INSERT INTO links (slug, url, created_at) VALUES (?,?,?)",
      )
        .bind(slug, target, Date.now())
        .run();
      return Response.json(
        { slug, shortUrl: `${url.origin}/${slug}` },
        { status: 201 },
      );
    }

    // 統計儀表板資料。D1 + 兩個 Analytics Engine SQL 查詢很慢且不穩,
    // 用 Cache API(caches.default)在邊緣快取「純資料 JSON」120 秒。
    // 命中與否,CORS header 一律用當下 origin 重套(快取裡不含 CORS)。
    if (req.method === "GET" && path === "/api/stats") {
      const cacheKey = new Request(STATS_CACHE_KEY);
      const cached = await caches.default.match(cacheKey);
      if (cached) {
        // 命中:取快取的純資料 body,重新套 CORS(ACAO 要 echo 當下 origin,
        // 不能沿用快取的)。debug header 方便驗證命中。
        const body = await cached.text();
        return new Response(body, {
          headers: {
            ...cors(req),
            "content-type": "application/json",
            "x-cache": "HIT",
          },
        });
      }

      // 未命中:照舊算(D1 + AE)。AE 未設定或查詢失敗時欄位為 null,前端自行降級。
      const total = await env.DB.prepare(
        "SELECT count(*) AS n FROM links",
      ).first<{ n: number }>();
      const clicks = await fetchClickStats(env, CLICKS_DATASET);
      const visitors = await fetchVisitStats(env);
      const data = {
        links: total?.n ?? 0,
        clicks24h: clicks?.clicks24h ?? null,
        topLinks: clicks?.topLinks ?? [],
        visitors,
      };

      // 寫入快取的是「純資料」(不含 CORS header,帶 Cache-Control: max-age=N);
      // 用 clone 寫,原 response 直接回給使用者。waitUntil 讓寫快取不阻塞回應。
      // 降級(AE 或訪客查詢回 null)→ 短 TTL,讓後端復原後很快撿回完整資料。
      const degraded = clicks === null || visitors === null;
      const ttl = degraded ? STATS_CACHE_TTL_DEGRADED : STATS_CACHE_TTL;
      const toCache = Response.json(data, {
        headers: { "cache-control": `max-age=${ttl}` },
      });
      ctx.waitUntil(caches.default.put(cacheKey, toCache.clone()));

      // 回給使用者:同一份資料 + 當下 origin 的 CORS + debug header。
      return Response.json(data, {
        headers: { ...cors(req), "x-cache": "MISS" },
      });
    }

    // 訪客埋點 beacon:寫一筆訪問,一律回 204(fire-and-forget,不可報錯)。
    if (req.method === "GET" && path === "/api/visit") {
      try {
        const ip = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
        const country = (req as unknown as { cf?: { country?: string } }).cf?.country ?? "";
        // path 只收集不顯示(fetchVisitStats 不 select、前端不渲染);
        // 日後若要顯示務必跳脫。長度上限避免膨脹 D1 row。
        const visitedPath = (url.searchParams.get("path") ?? "").slice(0, 256);
        await recordVisit(env, ip, country, visitedPath);
      } catch {
        /* 寧可漏記一筆,不報錯 */
      }
      return new Response(null, { status: 204, headers: cors(req) });
    }

    // 轉址
    if (req.method === "GET" && SLUG_RE.test(path)) {
      const slug = path.slice(1);
      const row = await env.DB.prepare("SELECT url FROM links WHERE slug = ?")
        .bind(slug)
        .first<{ url: string }>();
      if (!row) return new Response("Not found", { status: 404 });
      // 埋點為盡力而為,失敗不可阻擋轉址。
      try {
        env.CLICKS.writeDataPoint({ blobs: [slug], indexes: [slug] });
      } catch {
        /* ignore */
      }
      // 直接設 Location,保留儲存的原始 URL(Response.redirect 會正規化加尾斜線)。
      return new Response(null, {
        status: 302,
        headers: { Location: row.url },
      });
    }

    return new Response("devbox api", { status: 200 });
  },
};
