import {
  validateQuestion,
  detectLang,
  buildPrompt,
  dedupeSources,
  type Chunk,
  type Source,
} from "./rag";

export interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  ASK_KV: KVNamespace;
}

const DAILY_CAP = 500;
const EMBED_MODEL = "@cf/baai/bge-m3";
const LLM_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST" || url.pathname !== "/api/ask")
      return new Response("not found", { status: 404 });

    const { question } = await req
      .json<{ question?: string }>()
      .catch(() => ({ question: "" }));
    const v = validateQuestion(question ?? "");
    if (!v.ok) return json({ error: v.reason }, 400);

    const dayKey = "count:" + new Date().toISOString().slice(0, 10);
    const used = Number((await env.ASK_KV.get(dayKey)) ?? 0);
    if (used >= DAILY_CAP) return json({ error: "daily_cap" }, 429);
    await env.ASK_KV.put(dayKey, String(used + 1), { expirationTtl: 172800 });

    const lang = detectLang(question!);
    const emb = (await env.AI.run(EMBED_MODEL, { text: [question!] })) as {
      data: number[][];
    };
    const vector = emb.data[0];

    const res = await env.VECTORIZE.query(vector, {
      topK: 5,
      returnMetadata: "all",
      filter: { lang },
    });
    const chunks: Chunk[] = res.matches.map((m) => ({
      text: String(m.metadata?.text ?? ""),
      source: String(m.metadata?.source ?? ""),
      title: String(m.metadata?.title ?? ""),
    }));
    const sources: Source[] = dedupeSources(
      chunks.map((c) => ({ source: c.source, title: c.title })),
    );

    const { system, user } = buildPrompt(question!, chunks, lang);
    const stream = await env.AI.run(LLM_MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
    });

    return new Response(stream as ReadableStream, {
      headers: {
        ...CORS,
        "content-type": "text/event-stream",
        "x-sources": JSON.stringify(sources),
      },
    });
  },
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
