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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
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

    // 統計(MVP:先回連結總數;點擊聚合於 Phase 6 接 Analytics Engine SQL API)
    // 加 CORS:儀表板頁在 pages.dev,跨網域讀此端點。
    // wildcard `*` 刻意:此端點 public 唯讀(僅連結數),且 pages.dev preview
    // 每次部署 origin 都不同,固定 origin 反而會壞。勿改成具名 origin。
    if (req.method === "GET" && path === "/api/stats") {
      const total = await env.DB.prepare(
        "SELECT count(*) AS n FROM links",
      ).first<{ n: number }>();
      // 真實點擊指標;AE 未設定或查詢失敗時為 null,前端自行降級。
      const clicks = await fetchClickStats(env, CLICKS_DATASET);
      const visitors = await fetchVisitStats(env);
      return Response.json(
        {
          links: total?.n ?? 0,
          clicks24h: clicks?.clicks24h ?? null,
          topLinks: clicks?.topLinks ?? [],
          visitors,
        },
        { headers: { "access-control-allow-origin": "*" } },
      );
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
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
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
