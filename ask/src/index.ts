import {
  validateQuestion,
  detectLang,
  buildPrompt,
  dedupeSources,
  type Chunk,
  type Source,
} from "./rag";

// Cloudflare Rate Limiting binding(原生、原子)。
interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  ASK_KV: KVNamespace;
  // 速率護欄:per-IP 與全域,擋快速燒 Workers AI 額度(KV 日上限仍保留為長期天花板)。
  // optional:miniflare 測試環境不提供 ratelimit binding,缺少時 rlOk 直接放行。
  RL_ASK_IP?: RateLimiter;
  RL_ASK_GLOBAL?: RateLimiter;
}

/** 查速率限制;無 binding(測試)或出錯 → fail-open 放行(KV 日上限仍是後盾)。 */
// 註:Cloudflare 官方明示 Rate Limiting binding 是 per-colo 的「寬鬆過濾」,
// 不是精確計數;小量 burst 會被放過,對「大量持續攻擊」才有效。它當寬鬆煞車,
// 真正的成本硬上限靠下方 KV 每日上限(DAILY_CAP / PER_IP_CAP)。
async function rlOk(rl: RateLimiter | undefined, key: string): Promise<boolean> {
  if (!rl) return true; // 測試/本機無 binding → 放行
  try {
    return (await rl.limit({ key })).success;
  } catch {
    return true; // fail-open;KV 日上限仍是後盾
  }
}

// 成本硬上限(KV 日計數,best-effort 但作為實際成本天花板;收緊以限制最壞情況花費)。
const DAILY_CAP = 250;
const PER_IP_CAP = 15;
const MAX_BODY_BYTES = 8192;
const EMBED_MODEL = "@cf/baai/bge-m3";
const LLM_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * CORS allowlist。站台(derek-chen.pages.dev,含隨機 preview 子網域)與 worker
 * 不同源,故須動態 echo origin;非允許來源不帶 allow-origin。
 */
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "access-control-allow-headers": "content-type",
    "access-control-expose-headers": "x-sources",
    "access-control-allow-methods": "POST, OPTIONS",
  };
  if (
    origin === "https://derek-chen.pages.dev" ||
    origin.endsWith(".derek-chen.pages.dev") ||
    origin.startsWith("http://localhost")
  ) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS")
      return new Response(null, { headers: cors(req) });
    if (req.method !== "POST" || url.pathname !== "/api/ask")
      return new Response("not found", { status: 404 });

    // 速率護欄(原生 Rate Limiting binding,原子):per-IP 6/分 + 全域 40/分,
    // 在讀 body / 呼叫 AI 之前就擋掉腳本快速燒額度(CORS 擋不住 curl)。
    const rlIp = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
    const [gOk, ipOk] = await Promise.all([
      rlOk(env.RL_ASK_GLOBAL, "ask"),
      rlOk(env.RL_ASK_IP, rlIp),
    ]);
    if (!gOk || !ipOk) return json({ error: "rate_limit" }, 429, req);

    // 大 payload 早擋:讀 body 前先看 content-length。
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_BODY_BYTES) return json({ error: "too_large" }, 413, req);

    const { question } = await req
      .json<{ question?: string }>()
      .catch(() => ({ question: "" }));
    const v = validateQuestion(question ?? "");
    if (!v.ok) return json({ error: v.reason }, 400, req);

    // 限流檢查(全域 + per-IP)在 guardrail 之後、embed 之前。
    // 註:KV 非原子(讀-改-寫有競態),全域上限為 best-effort;
    // 真正嚴格限流需 Durable Object / Rate Limiting binding(future)。
    const date = new Date().toISOString().slice(0, 10);
    const dayKey = "count:" + date;
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const ipKey = `ipcount:${date}:${ip}`;

    const used = Number((await env.ASK_KV.get(dayKey)) ?? 0);
    if (used >= DAILY_CAP) return json({ error: "daily_cap" }, 429, req);
    const ipUsed = Number((await env.ASK_KV.get(ipKey)) ?? 0);
    if (ipUsed >= PER_IP_CAP) return json({ error: "rate_limit" }, 429, req);

    const lang = detectLang(question!);

    // 外部呼叫 graceful degradation:embed → query 任一失敗回 503(帶 CORS)。
    let chunks: Chunk[];
    try {
      const emb = (await env.AI.run(EMBED_MODEL, { text: [question!] })) as {
        data: number[][];
      };
      const vector = emb.data?.[0];
      if (!vector || vector.length === 0)
        return json({ error: "unavailable" }, 503, req);

      let res = await env.VECTORIZE.query(vector, {
        topK: 5,
        returnMetadata: "all",
        filter: { lang },
      });
      // lang filter fallback:bge-m3 多語,短英文可能被誤判語言而撈不到,
      // 無命中時改查不帶 filter 的同樣 query。
      if (res.matches.length === 0) {
        res = await env.VECTORIZE.query(vector, {
          topK: 5,
          returnMetadata: "all",
        });
      }
      chunks = res.matches.map((m) => ({
        text: String(m.metadata?.text ?? ""),
        source: String(m.metadata?.source ?? ""),
        title: String(m.metadata?.title ?? ""),
      }));
    } catch {
      return json({ error: "unavailable" }, 503, req);
    }

    const sources: Source[] = dedupeSources(
      chunks.map((c) => ({ source: c.source, title: c.title })),
    );

    // 檢索成功後、呼叫 LLM 前才遞增計數,避免 embed/query 失敗也燒每日額度。
    // 讀-改-寫沿用現狀(best-effort,見上方註解)。
    await env.ASK_KV.put(dayKey, String(used + 1), { expirationTtl: 172800 });
    await env.ASK_KV.put(ipKey, String(ipUsed + 1), { expirationTtl: 86400 });

    const { system, user } = buildPrompt(question!, chunks, lang);

    let stream: ReadableStream;
    try {
      stream = (await env.AI.run(LLM_MODEL, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: true,
      })) as ReadableStream;
    } catch {
      return json({ error: "unavailable" }, 503, req);
    }

    return new Response(stream, {
      headers: {
        ...cors(req),
        "content-type": "text/event-stream",
        // encodeURIComponent:HTTP header 只可靠承載 latin1,來源標題含中文
        // 直接放會 mojibake;前端 decodeURIComponent 還原。
        "x-sources": encodeURIComponent(JSON.stringify(sources)),
      },
    });
  },
};

function json(obj: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...(req ? cors(req) : {}),
      "content-type": "application/json",
    },
  });
}
