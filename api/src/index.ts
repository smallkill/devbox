import { makeSlug, isValidUrl } from "./slug";

export interface Env {
  DB: D1Database;
  CLICKS: AnalyticsEngineDataset;
}

const SLUG_RE = /^\/[0-9a-zA-Z]{6}$/;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // 建立短網址
    if (req.method === "POST" && path === "/api/links") {
      const { url: target } = await req
        .json<{ url?: string }>()
        .catch(() => ({ url: undefined }));
      if (!target || !isValidUrl(target)) {
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
    if (req.method === "GET" && path === "/api/stats") {
      const total = await env.DB.prepare(
        "SELECT count(*) AS n FROM links",
      ).first<{ n: number }>();
      return Response.json({ links: total?.n ?? 0 });
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
