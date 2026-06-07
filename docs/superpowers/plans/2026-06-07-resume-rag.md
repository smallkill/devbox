# 履歷 RAG「Ask my resume」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在作品集加 `/ask` 頁,讓訪客用自然語言查詢 Derek 履歷;全 Cloudflare(Workers AI + Vectorize),有防幻覺與成本/濫用 guardrail。

**Architecture:** 新增獨立 `ask/` Worker:收問題 → guardrail → Workers AI embed → Vectorize 檢索 top-k → 組 grounding prompt → Workers AI LLM 串流生成 → 回答+引用來源。部署時 `ingest` 腳本把履歷內容+自傳 embed 進 Vectorize。`site/` 加雙語 `/ask` 頁。

**Tech Stack:** Cloudflare Workers、Workers AI(`@cf/baai/bge-m3` embeddings、Llama 3.3 instruct LLM)、Vectorize、KV(每日上限)、AI Gateway(快取/限流)、TypeScript、Vitest、Astro。

**前置需求(Derek 的 Cloudflare 帳號):** 建 Vectorize index、Workers AI 可用、AI Gateway、一個有 Workers AI + Vectorize 權限的 API token(ingest 用)。本機已有 wrangler。

---

## 檔案結構

```
ask/                              # 新 Worker workspace
├── package.json
├── tsconfig.json
├── wrangler.toml                 # AI / VECTORIZE / KV bindings + AI Gateway
├── vitest.config.ts
├── src/
│   ├── index.ts                  # POST /api/ask 路由 + guardrail + orchestration
│   ├── rag.ts                    # 純函式:chunkText / buildPrompt / validateQuestion / dedupeSources / detectLang
│   └── rag.test.ts
└── scripts/
    └── ingest.mjs                # 讀履歷內容+自傳 → chunk → embed(REST)→ upsert Vectorize(REST)
site/
├── src/pages/ask.astro           # /ask(zh)
├── src/pages/en/ask.astro        # /en/ask
├── src/components/AskChat.astro   # chat UI(輸入、串流、範例問題、來源)
└── src/i18n/ui.ts                # 加 ask_* 字串
```

---

## Phase 0 — Cloudflare 資源(需 Derek 帳號)

### Task 0.1: 建 Vectorize index + AI Gateway

- [ ] **Step 1: 建 Vectorize index**(bge-m3 維度 1024、cosine)

Run: `npx wrangler vectorize create resume --dimensions=1024 --metric=cosine`
Expected: 成功,回 index 名 `resume`。

- [ ] **Step 2: 建 metadata index(供依語言/類型過濾)**

Run:
```bash
npx wrangler vectorize create-metadata-index resume --property-name=lang --type=string
npx wrangler vectorize create-metadata-index resume --property-name=source --type=string
```
Expected: 兩個 metadata index 建立成功。

- [ ] **Step 3: 建 AI Gateway**(dashboard:AI → AI Gateway → Create,命名 `devbox-ask`)。記下 gateway id,供 wrangler.toml 與 ingest 用。設定其 rate limiting(例如 20 req/min)與 caching(開啟)。

- [ ] **Step 4: 建 KV namespace(每日上限計數)**

Run: `npx wrangler kv namespace create ASK_KV`
Expected: 回 namespace id,填進 wrangler.toml(下一 Task)。

---

## Phase 1 — `ask/` workspace 骨架

### Task 1.1: 建 workspace + wrangler.toml

**Files:** Create `ask/package.json`, `ask/tsconfig.json`, `ask/wrangler.toml`, `ask/vitest.config.ts`

- [ ] **Step 1: `ask/package.json`**

```json
{
  "name": "@devbox/ask",
  "private": true,
  "type": "module",
  "scripts": { "test": "vitest run", "deploy": "wrangler deploy", "ingest": "node scripts/ingest.mjs" },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.19",
    "@cloudflare/workers-types": "^4.20250109.0",
    "vitest": "~3.2.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: `ask/tsconfig.json`**(同 api/ 樣式)

```json
{ "extends": "../tsconfig.base.json", "compilerOptions": { "types": ["@cloudflare/workers-types"] }, "include": ["src/**/*.ts"] }
```

- [ ] **Step 3: `ask/wrangler.toml`**(填上 Phase 0 拿到的 gateway id 與 KV id)

```toml
name = "devbox-ask"
main = "src/index.ts"
compatibility_date = "2025-09-06"

[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "resume"

[[kv_namespaces]]
binding = "ASK_KV"
id = "PLACEHOLDER_FILL_AFTER_kv_create"

# 必要 secret(勿寫此檔):
#   wrangler secret put CF_ACCOUNT_ID   # AI Gateway URL 用
#   wrangler secret put CF_AI_GATEWAY    # gateway 名稱 devbox-ask
```

- [ ] **Step 4: `ask/vitest.config.ts`**

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
export default defineWorkersConfig({
  test: { poolOptions: { workers: { wrangler: { configPath: "./wrangler.toml" } } } },
});
```

- [ ] **Step 5: 加進 root workspaces** — 編輯 `package.json` 的 `"workspaces"` 加 `"ask"`。`npm install`。
- [ ] **Step 6: 提交** `git add ask package.json && git commit -m "chore(ask): worker scaffold"`

---

## Phase 2 — `rag.ts` 純函式(TDD)

### Task 2.1: validateQuestion(guardrail)

**Files:** Create `ask/src/rag.ts`, `ask/src/rag.test.ts`

- [ ] **Step 1: 寫失敗測試 `ask/src/rag.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { validateQuestion, detectLang, dedupeSources } from "./rag";

describe("validateQuestion", () => {
  it("正常問題通過", () => {
    expect(validateQuestion("你做過哪些雲端專案?")).toEqual({ ok: true });
  });
  it("空字串擋掉", () => {
    expect(validateQuestion("  ").ok).toBe(false);
  });
  it("過長擋掉", () => {
    expect(validateQuestion("a".repeat(501)).ok).toBe(false);
  });
});

describe("detectLang", () => {
  it("含中文 → zh", () => expect(detectLang("你好 hello")).toBe("zh"));
  it("純英文 → en", () => expect(detectLang("what is your AWS experience")).toBe("en"));
});

describe("dedupeSources", () => {
  it("依 source 去重、保留順序", () => {
    expect(dedupeSources([
      { source: "rsu-warning", title: "RSU" },
      { source: "rsu-warning", title: "RSU" },
      { source: "avm-3d", title: "AVM" },
    ])).toEqual([
      { source: "rsu-warning", title: "RSU" },
      { source: "avm-3d", title: "AVM" },
    ]);
  });
});
```

- [ ] **Step 2: 跑確認失敗**

Run: `cd ask && npx vitest run`
Expected: FAIL — 模組不存在。

- [ ] **Step 3: 實作 `ask/src/rag.ts`**

```ts
export interface Source { source: string; title: string; }

const MAX_LEN = 500;

export function validateQuestion(q: string): { ok: boolean; reason?: string } {
  const t = q.trim();
  if (!t) return { ok: false, reason: "empty" };
  if (t.length > MAX_LEN) return { ok: false, reason: "too_long" };
  return { ok: true };
}

export function detectLang(q: string): "zh" | "en" {
  return /[一-鿿]/.test(q) ? "zh" : "en";
}

export function dedupeSources(srcs: Source[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of srcs) {
    if (seen.has(s.source)) continue;
    seen.add(s.source);
    out.push(s);
  }
  return out;
}
```

- [ ] **Step 4: 跑確認通過** `cd ask && npx vitest run` → PASS。
- [ ] **Step 5: 提交** `git add ask && git commit -m "feat(ask): question guardrail + lang detect + source dedupe (TDD)"`

### Task 2.2: buildPrompt(grounding)

**Files:** Modify `ask/src/rag.ts`, `ask/src/rag.test.ts`

- [ ] **Step 1: 加失敗測試**

```ts
import { buildPrompt } from "./rag";

describe("buildPrompt", () => {
  const chunks = [{ text: "在 Turing 帶雲端團隊", source: "fleet-monitoring", title: "車隊監控" }];
  it("system prompt 含 grounding 規則與語言指示", () => {
    const { system } = buildPrompt("你做過什麼?", chunks, "zh");
    expect(system).toContain("只能根據");
    expect(system.toLowerCase()).not.toContain("make up");
    expect(system).toContain("中文");
  });
  it("user prompt 含檢索片段與問題", () => {
    const { user } = buildPrompt("你做過什麼?", chunks, "zh");
    expect(user).toContain("在 Turing 帶雲端團隊");
    expect(user).toContain("你做過什麼?");
  });
  it("無片段時 system 要求回答沒有資訊", () => {
    const { system } = buildPrompt("天氣如何?", [], "zh");
    expect(system).toContain("沒有");
  });
});
```

- [ ] **Step 2: 跑確認失敗** → FAIL。

- [ ] **Step 3: 實作 `buildPrompt`(加入 rag.ts)**

```ts
export interface Chunk { text: string; source: string; title: string; }

export function buildPrompt(question: string, chunks: Chunk[], lang: "zh" | "en") {
  const langName = lang === "zh" ? "中文" : "English";
  const context = chunks.length
    ? chunks.map((c, i) => `[${i + 1}] (${c.title}) ${c.text}`).join("\n\n")
    : "(無相關片段)";
  const system = [
    `你是 Derek Chen 履歷的問答助理。只能根據下方提供的「履歷片段」回答。`,
    `若片段中找不到答案,直接說「我的履歷裡沒有這個資訊」,絕不臆測或編造。`,
    `用 ${langName} 回答,簡潔、第一人稱以 Derek 的角度。`,
    `拒答薪資、聯絡電話、個資等敏感問題,引導對方直接看履歷或來信。`,
  ].join("\n");
  const user = `履歷片段:\n${context}\n\n問題:${question}`;
  return { system, user };
}
```

- [ ] **Step 4: 跑確認通過** → PASS。
- [ ] **Step 5: 提交** `git commit -m "feat(ask): grounding prompt builder (TDD)"`

### Task 2.3: chunkText(ingest 用)

**Files:** Modify `ask/src/rag.ts`, `ask/src/rag.test.ts`

- [ ] **Step 1: 加失敗測試**

```ts
import { chunkText } from "./rag";
describe("chunkText", () => {
  it("短文不切", () => {
    expect(chunkText("一段短文", 200)).toEqual(["一段短文"]);
  });
  it("長文依段落切、不超過上限", () => {
    const text = "段落一。".repeat(50) + "\n\n" + "段落二。".repeat(50);
    const chunks = chunkText(text, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(220);
  });
});
```

- [ ] **Step 2: 跑確認失敗** → FAIL。

- [ ] **Step 3: 實作 `chunkText`**

```ts
/** 依段落切;單段超過 max 則再依句切;近似上限。 */
export function chunkText(text: string, max = 600): string[] {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  const flush = () => { if (buf) { out.push(buf.trim()); buf = ""; } };
  for (const p of paras) {
    if (p.length > max) {
      flush();
      let chunk = "";
      for (const s of p.split(/(?<=[。.!?])/)) {
        if ((chunk + s).length > max) { if (chunk) out.push(chunk.trim()); chunk = s; }
        else chunk += s;
      }
      if (chunk) out.push(chunk.trim());
    } else if ((buf + "\n\n" + p).length > max) {
      flush(); buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  flush();
  return out;
}
```

- [ ] **Step 4: 跑確認通過** → PASS。
- [ ] **Step 5: 提交** `git commit -m "feat(ask): chunkText for ingest (TDD)"`

---

## Phase 3 — `ask` Worker 端點

### Task 3.1: orchestration + 每日上限

**Files:** Create `ask/src/index.ts`

- [ ] **Step 1: 實作 `ask/src/index.ts`**

```ts
import { validateQuestion, detectLang, buildPrompt, dedupeSources, type Chunk, type Source } from "./rag";

export interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  ASK_KV: KVNamespace;
  CF_ACCOUNT_ID: string;
  CF_AI_GATEWAY: string;
}

const DAILY_CAP = 500;          // 全站每日問答上限,超過婉拒
const EMBED_MODEL = "@cf/baai/bge-m3";
const LLM_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" };

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST" || url.pathname !== "/api/ask")
      return new Response("not found", { status: 404 });

    const { question } = await req.json<{ question?: string }>().catch(() => ({ question: "" }));
    const v = validateQuestion(question ?? "");
    if (!v.ok) return json({ error: v.reason }, 400);

    // 每日上限(KV 計數,key 含 UTC 日期)
    const dayKey = "count:" + new Date().toISOString().slice(0, 10);
    const used = Number((await env.ASK_KV.get(dayKey)) ?? 0);
    if (used >= DAILY_CAP) return json({ error: "daily_cap" }, 429);
    await env.ASK_KV.put(dayKey, String(used + 1), { expirationTtl: 172800 });

    const lang = detectLang(question!);
    const opts = { gateway: { id: env.CF_AI_GATEWAY } };

    // ① embed 問題
    const emb = await env.AI.run(EMBED_MODEL, { text: [question!] }, opts);
    const vector = (emb as { data: number[][] }).data[0];

    // ② Vectorize 檢索(依語言過濾)
    const matches = await env.VECTORIZE.query(vector, {
      topK: 5, returnMetadata: "all", filter: { lang },
    });
    const chunks: Chunk[] = matches.matches.map((m) => ({
      text: String(m.metadata?.text ?? ""),
      source: String(m.metadata?.source ?? ""),
      title: String(m.metadata?.title ?? ""),
    }));
    const sources: Source[] = dedupeSources(chunks.map((c) => ({ source: c.source, title: c.title })));

    // ③ grounding prompt + ④ LLM streaming
    const { system, user } = buildPrompt(question!, chunks, lang);
    const stream = await env.AI.run(LLM_MODEL, {
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      stream: true,
    }, opts);

    // 把來源放 header,body 串流答案
    return new Response(stream as ReadableStream, {
      headers: { ...CORS, "content-type": "text/event-stream", "x-sources": JSON.stringify(sources) },
    });
  },
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
```

- [ ] **Step 2: 加路由/guardrail 整合測試 `ask/src/index.test.ts`**(空問題 400、過長 400;LLM/Vectorize 在 pool 不可用,故只測 guardrail 分支)

```ts
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
const post = (body: unknown) => SELF.fetch("https://x/api/ask", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("/api/ask guardrail", () => {
  it("空問題回 400", async () => { expect((await post({ question: " " })).status).toBe(400); });
  it("過長回 400", async () => { expect((await post({ question: "a".repeat(501) })).status).toBe(400); });
  it("GET 回 404", async () => { expect((await SELF.fetch("https://x/api/ask")).status).toBe(404); });
});
```

> 註:正常問答路徑會呼叫 Workers AI / Vectorize,vitest-pool-workers 無法 mock binding,故整合測試只覆蓋 guardrail;正常路徑於部署後人工驗收(Phase 5)。

- [ ] **Step 3: build/test 驗證** `cd ask && npx vitest run` → guardrail 測試綠。
- [ ] **Step 4: 提交** `git commit -m "feat(ask): /api/ask orchestration + daily cap + streaming"`

---

## Phase 4 — ingest 腳本

### Task 4.1: ingest.mjs(讀內容 → embed → upsert)

**Files:** Create `ask/scripts/ingest.mjs`

- [ ] **Step 1: 實作 `ask/scripts/ingest.mjs`**(用 Cloudflare REST:embeddings + Vectorize upsert;讀 env `CF_ACCOUNT_ID`、`CF_API_TOKEN`)

```js
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chunkText } from "../src/rag.ts"; // 透過 tsx/esbuild 或先 build;見 Step 2 註

const ACCOUNT = process.env.CF_ACCOUNT_ID;
const TOKEN = process.env.CF_API_TOKEN;          // 需 Workers AI + Vectorize 權限
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`;
const EMBED_MODEL = "@cf/baai/bge-m3";
const SITE = join(process.cwd(), "..", "site", "src", "content");
const AUTOBIO = join(process.env.HOME, "Career", "resume-2026", "_organized", "md");

// 1) 收集來源文件(各帶 metadata)
function collect() {
  const docs = [];
  for (const coll of ["experience", "projects"]) {
    for (const lang of ["zh", "en"]) {
      const dir = join(SITE, coll, lang);
      for (const f of readdirSync(dir).filter((x) => x.endsWith(".md"))) {
        const raw = readFileSync(join(dir, f), "utf8");
        const title = (raw.match(/^title:\s*(.+)$/m)?.[1] ?? raw.match(/^org:\s*(.+)$/m)?.[1] ?? f).trim();
        const body = raw.replace(/^---[\s\S]*?---/, "").trim() + "\n" + (raw.match(/highlights:[\s\S]*?(?=\n\w+:|---)/)?.[0] ?? "");
        docs.push({ source: f.replace(/\.md$/, ""), lang, title, text: body });
      }
    }
  }
  for (const lang of ["zh", "en"]) {
    const f = join(AUTOBIO, `autobio-${lang}.md`);
    docs.push({ source: "autobio", lang, title: lang === "zh" ? "自傳" : "About", text: readFileSync(f, "utf8") });
  }
  return docs;
}

async function embed(texts) {
  const r = await fetch(`${API}/ai/run/${EMBED_MODEL}`, {
    method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ text: texts }),
  });
  const j = await r.json();
  if (!j.success) throw new Error("embed failed: " + JSON.stringify(j.errors));
  return j.result.data;
}

const docs = collect();
const vectors = [];
let id = 0;
for (const d of docs) {
  const chunks = chunkText(d.text, 600);
  const embs = await embed(chunks);
  chunks.forEach((text, i) => vectors.push({
    id: `${d.source}-${d.lang}-${id++}`,
    values: embs[i],
    metadata: { text, source: d.source, title: d.title, lang: d.lang },
  }));
}
// 2) upsert 到 Vectorize(NDJSON)
const ndjson = vectors.map((v) => JSON.stringify(v)).join("\n");
const up = await fetch(`${API}/vectorize/v2/indexes/resume/upsert`, {
  method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/x-ndjson" }, body: ndjson,
});
console.log("upsert:", await up.json());
console.log(`ingested ${vectors.length} chunks from ${docs.length} docs`);
```

> 註:`import { chunkText } from "../src/rag.ts"` 在純 node 無法直接跑 TS。實作時擇一:(a) 用 `node --experimental-strip-types`(Node 24 支援);(b) 把 chunkText 複製成 `.mjs` 小工具。以 (a) 為主(本機 Node 24)。

- [ ] **Step 2: 跑 ingest(需 token)**

```bash
cd ask && CF_ACCOUNT_ID=<id> CF_API_TOKEN=<token> node --experimental-strip-types scripts/ingest.mjs
```
Expected: 印出 `ingested N chunks from M docs`,Vectorize 有資料。

- [ ] **Step 3: 提交** `git add ask/scripts && git commit -m "feat(ask): ingest script (content+autobio → embed → vectorize)"`

---

## Phase 5 — `/ask` 頁(雙語 chat UI)

### Task 5.1: UI 字串 + AskChat 元件

**Files:** Modify `site/src/i18n/ui.ts`; Create `site/src/components/AskChat.astro`

- [ ] **Step 1: 加 `ask_*` UI 字串**(zh/en)

```ts
// zh:
ask_title: "問我任何事", ask_intro: "用自然語言問我的經歷、專案、技能——AI 只根據我的履歷回答。",
ask_placeholder: "例如:你做過哪些雲端架構的專案?",
ask_send: "送出", ask_thinking: "思考中…", ask_sources: "引用自", ask_error: "AI 暫時無法回應,請直接瀏覽履歷。",
ask_examples: ["你帶過團隊嗎?", "你最擅長的雲端技術?", "AVM 專案在做什麼?"],
// en:
ask_title: "Ask me anything", ask_intro: "Ask about my experience, projects, or skills — the AI answers only from my resume.",
ask_placeholder: "e.g. What cloud-architecture projects have you built?",
ask_send: "Send", ask_thinking: "Thinking…", ask_sources: "Sources", ask_error: "AI is unavailable right now — please browse the resume.",
ask_examples: ["Have you led a team?", "Your strongest cloud skills?", "What is the AVM project?"],
```

- [ ] **Step 2: `AskChat.astro`**(接 `lang`、`endpoint`;輸入框、範例 chips、串流顯示、來源、error/loading)— 用 fetch + ReadableStream reader 逐字 append;`x-sources` header 解析顯示來源,連到 `/projects/<source>` 或 `/#experience`。完整 client script 含 DOM-safe 渲染、串流讀取、錯誤降級。
- [ ] **Step 3: build 驗證** `cd site && npx astro build` → 成功。
- [ ] **Step 4: 提交** `git commit -m "feat(site): AskChat component + ask UI strings"`

### Task 5.2: /ask 頁(zh + en)+ nav

**Files:** Create `site/src/pages/ask.astro`, `site/src/pages/en/ask.astro`; Modify `site/src/layouts/Base.astro`

- [ ] **Step 1:** `pages/ask.astro` = `<Base lang="zh" path="/ask"><AskChat lang="zh" endpoint={import.meta.env.PUBLIC_ASK_URL}/></Base>`;`en/ask.astro` 同理 lang="en"。
- [ ] **Step 2:** Base nav 加 `<a href={base + "/ask"}>{t.ask_title}</a>`。
- [ ] **Step 3: build + Playwright 截圖驗證** 頁面結構、範例 chips、輸入框正常。
- [ ] **Step 4: 提交** `git commit -m "feat(site): bilingual /ask page + nav link"`

---

## Phase 6 — 部署 + 人工驗收

### Task 6.1: 部署 ask Worker + 設 secret

- [ ] **Step 1: 設 secrets** `cd ask && wrangler secret put CF_ACCOUNT_ID` 與 `wrangler secret put CF_AI_GATEWAY`(值 `devbox-ask`)。
- [ ] **Step 2: 部署** `npx wrangler deploy` → 取得 `devbox-ask.<subdomain>.workers.dev`。
- [ ] **Step 3: 部署 site**(設 `PUBLIC_ASK_URL` 指向 ask worker)`cd site && PUBLIC_ASK_URL=<ask worker url> npm run build && wrangler pages deploy dist --project-name derek-chen --branch main`。

### Task 6.2: 驗收

- [ ] **Step 1:** 中英各問 2-3 個代表問題(經歷、專案、技能)→ 回答正確且**附正確引用來源**。
- [ ] **Step 2:** 離題問題(「今天天氣?」「你薪水多少?」)→ 應婉拒、不臆測。
- [ ] **Step 3:** 連續快速送 → 觀察 AI Gateway rate limit 生效;送到超過 DAILY_CAP → 回婉拒訊息。
- [ ] **Step 4:** 確認 AI Gateway dashboard 有流量/快取命中、Workers AI 用量在免費額度內。

---

## Self-Review

- **Spec 覆蓋**:Workers AI+Vectorize 架構(0/3)✅、ingest 履歷+自傳(4)✅、grounding 防幻覺(2.2/3)✅、成本與限流(0.1 AI Gateway + 3.1 DAILY_CAP)✅、雙語(detectLang + lang filter + 雙語頁)✅、串流(3.1/5.1)✅、引用來源(dedupeSources + x-sources header + UI)✅、/ask 頁+nav(5)✅、測試策略(rag.ts TDD + guardrail 整合)✅。
- **Placeholder**:KV id、gateway id、token 為帳號相依,已明確標 PLACEHOLDER/帳號相依步驟;`AskChat.astro` 完整 client script 於實作 Task 5.1 寫出(此處描述其契約)。非未決 placeholder。
- **型別一致**:`Chunk`/`Source`/`Env`(AI/VECTORIZE/ASK_KV/CF_ACCOUNT_ID/CF_AI_GATEWAY)、`validateQuestion`/`detectLang`/`buildPrompt`/`dedupeSources`/`chunkText` 命名前後一致。
- **已知刻意延後**:多輪記憶、ingest 接 CI(先手動)、確切 LLM 模型(部署後比中文品質可換)。
