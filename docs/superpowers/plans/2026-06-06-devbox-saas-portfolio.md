# devbox SaaS 作品集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自架一個短網址 SaaS,從 `git push` 經 CI/CD 自動部署到 Cloudflare,附即時監控儀表板、Telegram 告警與履歷頁。

**Architecture:** Monorepo,三個部署單元——`api`(Workers + D1 + Analytics Engine)、`site`(Astro on Pages,含履歷與儀表板)、`watchdog`(Cron Worker 發 Telegram 告警)。GitHub Actions 跑 lint/typecheck/test,`main` 綠燈後 `wrangler deploy`。

**Tech Stack:** TypeScript、Cloudflare Workers / Pages / D1 / Analytics Engine、Wrangler 4、Astro、Vitest、ESLint、GitHub Actions。

**前置需求(開工前 Derek 要先有):** Cloudflare 帳號、GitHub repo、(可選)自訂網域、Telegram bot token。本機已具備 Node v24.16 + Wrangler 4.98。

---

## 檔案結構(decomposition)

```
~/projects/devbox/
├── package.json                # workspace root（pnpm/npm workspaces）
├── tsconfig.base.json
├── .eslintrc.cjs
├── .github/workflows/ci.yml    # CI/CD pipeline
├── api/
│   ├── wrangler.toml           # Worker + D1 + Analytics Engine bindings
│   ├── src/index.ts            # 路由入口
│   ├── src/slug.ts             # slug 產生 + URL 驗證（純函式）
│   ├── src/stats.ts            # Analytics Engine 聚合查詢
│   ├── schema.sql              # D1 schema
│   └── test/*.test.ts          # vitest
├── watchdog/
│   ├── wrangler.toml           # Cron Trigger Worker
│   └── src/index.ts            # 查指標 + Telegram 告警
└── site/                       # Astro
    ├── src/pages/index.astro   # 履歷
    └── src/pages/status.astro  # 儀表板（fetch /api/stats）
```

---

## Phase 0 — 專案骨架與工具鏈

### Task 0.1: Workspace 骨架

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.eslintrc.cjs`

- [ ] **Step 1: 建 root package.json(workspaces)**

```json
{
  "name": "devbox",
  "private": true,
  "workspaces": ["api", "watchdog", "site"],
  "scripts": {
    "lint": "eslint . --ext .ts",
    "typecheck": "tsc -b --pretty",
    "test": "npm run test --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.base.json + .gitignore**

`.gitignore`:
```
node_modules/
dist/
.wrangler/
.dev.vars
.astro/
```

- [ ] **Step 3: 安裝 + 提交**

```bash
cd ~/projects/devbox && npm install
git add -A && git commit -m "chore: workspace scaffold"
```
Expected: `npm install` 成功、`git log` 有此 commit。

---

## Phase 1 — api:slug 與轉址核心(TDD)

### Task 1.1: slug 產生與 URL 驗證(純函式,先 TDD)

**Files:**
- Create: `api/src/slug.ts`, `api/test/slug.test.ts`, `api/package.json`, `api/tsconfig.json`, `api/vitest.config.ts`

- [ ] **Step 1: 寫失敗測試 `api/test/slug.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { makeSlug, isValidUrl } from "../src/slug";

describe("makeSlug", () => {
  it("回傳 6 碼英數字串", () => {
    const s = makeSlug();
    expect(s).toMatch(/^[0-9a-zA-Z]{6}$/);
  });
  it("兩次呼叫不相同", () => {
    expect(makeSlug()).not.toBe(makeSlug());
  });
});

describe("isValidUrl", () => {
  it("接受 https 網址", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
  });
  it("拒絕非 http(s)", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("not a url")).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd api && npx vitest run`
Expected: FAIL — `Cannot find module '../src/slug'`

- [ ] **Step 3: 實作 `api/src/slug.ts`**

```ts
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function makeSlug(len = 6): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd api && npx vitest run`
Expected: PASS(4 tests)

- [ ] **Step 5: 提交**

```bash
git add api && git commit -m "feat(api): slug generation and url validation"
```

### Task 1.2: D1 schema + 路由(建立/轉址)

**Files:**
- Create: `api/schema.sql`, `api/wrangler.toml`, `api/src/index.ts`, `api/test/routes.test.ts`

- [ ] **Step 1: D1 schema `api/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS links (
  slug TEXT PRIMARY KEY,
  url  TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

- [ ] **Step 2: `api/wrangler.toml`(bindings)**

```toml
name = "devbox-api"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "DB"
database_name = "devbox"
database_id = "PLACEHOLDER_FILL_AFTER_d1_create"

[[analytics_engine_datasets]]
binding = "CLICKS"
dataset = "devbox_clicks"
```

- [ ] **Step 3: 寫失敗整合測試 `api/test/routes.test.ts`**(用 `@cloudflare/vitest-pool-workers` 提供 D1)

```ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS links (slug TEXT PRIMARY KEY, url TEXT NOT NULL, created_at INTEGER NOT NULL)"
  );
});

describe("POST /api/links", () => {
  it("建立短網址回傳 slug", async () => {
    const res = await SELF.fetch("https://x/api/links", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(201);
    const body = await res.json<{ slug: string }>();
    expect(body.slug).toMatch(/^[0-9a-zA-Z]{6}$/);
  });

  it("非法 URL 回 400", async () => {
    const res = await SELF.fetch("https://x/api/links", {
      method: "POST",
      body: JSON.stringify({ url: "nope" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /:slug", () => {
  it("已知 slug 回 302", async () => {
    await env.DB.prepare("INSERT INTO links VALUES (?,?,?)")
      .bind("abc123", "https://example.org", Date.now())
      .run();
    const res = await SELF.fetch("https://x/abc123", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.org");
  });

  it("未知 slug 回 404", async () => {
    const res = await SELF.fetch("https://x/zzzzzz", { redirect: "manual" });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 4: 跑確認失敗**

Run: `cd api && npx vitest run`
Expected: FAIL — handler 尚未實作

- [ ] **Step 5: 實作 `api/src/index.ts`**

```ts
import { makeSlug, isValidUrl } from "./slug";

export interface Env {
  DB: D1Database;
  CLICKS: AnalyticsEngineDataset;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "POST" && path === "/api/links") {
      const { url: target } = await req.json<{ url?: string }>().catch(() => ({}));
      if (!target || !isValidUrl(target)) {
        return Response.json({ error: "invalid url" }, { status: 400 });
      }
      const slug = makeSlug();
      await env.DB.prepare("INSERT INTO links (slug, url, created_at) VALUES (?,?,?)")
        .bind(slug, target, Date.now())
        .run();
      return Response.json({ slug, shortUrl: `${url.origin}/${slug}` }, { status: 201 });
    }

    if (req.method === "GET" && /^\/[0-9a-zA-Z]{6}$/.test(path)) {
      const slug = path.slice(1);
      const row = await env.DB.prepare("SELECT url FROM links WHERE slug = ?")
        .bind(slug)
        .first<{ url: string }>();
      if (!row) return new Response("Not found", { status: 404 });
      // 埋點為盡力而為,失敗不可阻擋轉址
      try {
        env.CLICKS.writeDataPoint({ blobs: [slug], indexes: [slug] });
      } catch { /* ignore */ }
      return Response.redirect(row.url, 302);
    }

    return new Response("devbox api", { status: 200 });
  },
};
```

- [ ] **Step 6: 跑確認通過**

Run: `cd api && npx vitest run`
Expected: PASS(全部)

- [ ] **Step 7: 提交**

```bash
git add api && git commit -m "feat(api): create-link and redirect routes with D1"
```

---

## Phase 2 — api:點擊統計

### Task 2.1: `/api/stats` 聚合

**Files:**
- Create: `api/src/stats.ts`
- Modify: `api/src/index.ts`(加 `/api/stats` 路由)
- Create: `api/test/stats.test.ts`

- [ ] **Step 1: 寫失敗測試 `api/test/stats.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildStatsQuery } from "../src/stats";

describe("buildStatsQuery", () => {
  it("產生查近 24h 聚合的 SQL", () => {
    const sql = buildStatsQuery("devbox_clicks");
    expect(sql).toContain("devbox_clicks");
    expect(sql.toLowerCase()).toContain("count");
  });
});
```

- [ ] **Step 2: 跑確認失敗**

Run: `cd api && npx vitest run stats`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作 `api/src/stats.ts`**

```ts
// 注意:Analytics Engine 查詢走 Cloudflare SQL API（HTTP），非 D1。
// 此函式僅組裝 SQL 字串,實際送出在 index.ts 用 account API token。
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
```

- [ ] **Step 4: 跑確認通過 → 提交**

Run: `cd api && npx vitest run stats` → PASS
```bash
git add api && git commit -m "feat(api): stats query builder"
```

- [ ] **Step 5: 在 `api/src/index.ts` 加 `/api/stats` 路由**

```ts
// 在 fetch() 內、redirect 判斷之前加入:
if (req.method === "GET" && path === "/api/stats") {
  const total = await env.DB.prepare("SELECT count(*) AS n FROM links").first<{ n: number }>();
  // MVP:先回連結總數;點擊聚合接 SQL API 後補上(見 stats.ts）
  return Response.json({ links: total?.n ?? 0 });
}
```

- [ ] **Step 6: 加測試 `/api/stats` 回 200 + JSON,跑通,提交**

```bash
git add api && git commit -m "feat(api): /api/stats endpoint"
```

> 註:Analytics Engine 點擊聚合需 account-level API token 經 SQL API 查詢;MVP 先回連結數,Phase 6 部署拿到 token 後接上真實點擊聚合。

---

## Phase 3 — site:履歷 + 儀表板(Astro on Pages)

### Task 3.1: Astro scaffold + 履歷頁

**Files:**
- Create: `site/`(`npm create astro`)、`site/src/pages/index.astro`

- [ ] **Step 1: 建 Astro 專案**

```bash
cd ~/projects/devbox && npm create astro@latest site -- --template minimal --no-install --no-git --yes
```
Expected: `site/` 生成。

- [ ] **Step 2: 寫履歷頁 `site/src/pages/index.astro`**(放姓名、經歷、技能、連到 `/status`)

```astro
---
const skills = ["TypeScript", "Cloudflare Workers", "CI/CD", "Observability"];
---
<html lang="zh-Hant"><head><meta charset="utf-8"><title>Derek — SWE</title></head>
<body>
  <h1>Derek</h1>
  <p>Software Engineer · 自架 SaaS / DevOps</p>
  <ul>{skills.map((s) => <li>{s}</li>)}</ul>
  <a href="/status">→ 系統即時狀態儀表板</a>
</body></html>
```

- [ ] **Step 3: 本機跑起來確認**

Run: `cd site && npm install && npm run dev`
Expected: 開 localhost 看得到履歷頁。

- [ ] **Step 4: 提交**

```bash
git add site && git commit -m "feat(site): astro scaffold + resume page"
```

### Task 3.2: 儀表板頁 `/status`

**Files:**
- Create: `site/src/pages/status.astro`

- [ ] **Step 1: 寫 `status.astro`**(client fetch `/api/stats` 畫數字)

```astro
<html lang="zh-Hant"><head><meta charset="utf-8"><title>Status</title></head>
<body>
  <h1>devbox status</h1>
  <p>連結總數:<span id="links">…</span></p>
  <script>
    const API = import.meta.env.PUBLIC_API_URL ?? "";
    fetch(`${API}/api/stats`).then(r => r.json()).then(d => {
      document.getElementById("links").textContent = d.links;
    }).catch(() => {
      document.getElementById("links").textContent = "離線";
    });
  </script>
</body></html>
```

- [ ] **Step 2: 本機驗證(api 用 `wrangler dev` 起在另一埠,設 `PUBLIC_API_URL`)→ 提交**

```bash
git add site && git commit -m "feat(site): status dashboard page"
```

---

## Phase 4 — watchdog:Cron 告警 Worker

### Task 4.1: Cron Worker + Telegram 告警

**Files:**
- Create: `watchdog/wrangler.toml`, `watchdog/src/index.ts`, `watchdog/test/alert.test.ts`

- [ ] **Step 1: `watchdog/wrangler.toml`**

```toml
name = "devbox-watchdog"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[triggers]
crons = ["*/15 * * * *"]
```

- [ ] **Step 2: 寫失敗測試 `watchdog/test/alert.test.ts`**(純函式 `shouldAlert`)

```ts
import { describe, it, expect } from "vitest";
import { shouldAlert } from "../src/index";

describe("shouldAlert", () => {
  it("錯誤率超標要告警", () => {
    expect(shouldAlert({ errorRate: 0.2, p95ms: 100 })).toBe(true);
  });
  it("正常不告警", () => {
    expect(shouldAlert({ errorRate: 0.01, p95ms: 100 })).toBe(false);
  });
  it("延遲超標要告警", () => {
    expect(shouldAlert({ errorRate: 0, p95ms: 2000 })).toBe(true);
  });
});
```

- [ ] **Step 3: 跑確認失敗**

Run: `cd watchdog && npx vitest run`
Expected: FAIL

- [ ] **Step 4: 實作 `watchdog/src/index.ts`**

```ts
export interface Metrics { errorRate: number; p95ms: number; }
export interface Env { TELEGRAM_TOKEN: string; TELEGRAM_CHAT_ID: string; }

const ERROR_THRESHOLD = 0.05;
const P95_THRESHOLD_MS = 1000;

export function shouldAlert(m: Metrics): boolean {
  return m.errorRate > ERROR_THRESHOLD || m.p95ms > P95_THRESHOLD_MS;
}

async function fetchMetrics(): Promise<Metrics> {
  // Phase 6 接 Analytics Engine SQL API;先回安全值
  return { errorRate: 0, p95ms: 0 };
}

async function notify(env: Env, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
}

export default {
  async scheduled(_ctrl: ScheduledController, env: Env): Promise<void> {
    const m = await fetchMetrics();
    if (shouldAlert(m)) {
      await notify(env, `⚠️ devbox 異常:errorRate=${m.errorRate}, p95=${m.p95ms}ms`);
    }
  },
};
```

- [ ] **Step 5: 跑確認通過 → 提交**

```bash
cd watchdog && npx vitest run   # PASS
git add watchdog && git commit -m "feat(watchdog): cron alert worker + telegram"
```

> Telegram token/chat_id 用 `wrangler secret put` 設,不進 git。

---

## Phase 5 — CI/CD(GitHub Actions)

### Task 5.1: CI pipeline(lint/typecheck/test)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: 寫 `ci.yml`(PR + push 跑品質關卡)**

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 2: push 後在 GitHub 確認 workflow 綠燈 → 提交**

```bash
git add .github && git commit -m "ci: lint/typecheck/test pipeline"
```

### Task 5.2: CD(main 綠燈後自動 deploy)

**Files:**
- Modify: `.github/workflows/ci.yml`(加 deploy job)

- [ ] **Step 1: 加 deploy job(僅 main、需 quality 通過)**

```yaml
  deploy:
    needs: quality
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - run: npx wrangler deploy --config api/wrangler.toml
        env: { CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }} }
      - run: npx wrangler deploy --config watchdog/wrangler.toml
        env: { CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }} }
```

- [ ] **Step 2: 在 GitHub repo Settings → Secrets 設 `CLOUDFLARE_API_TOKEN`**(Cloudflare dashboard 產 token,權限:Workers Scripts Edit、D1 Edit)

- [ ] **Step 3: push 確認自動部署 → 提交**

```bash
git add .github && git commit -m "ci: auto-deploy to cloudflare on main"
```

---

## Phase 6 — 上線、接真實指標、監控

### Task 6.1: 建立 Cloudflare 資源

- [ ] **Step 1: 建 D1 並填 database_id**

```bash
cd api && npx wrangler d1 create devbox
# 把回傳的 database_id 填進 api/wrangler.toml,然後套 schema:
npx wrangler d1 execute devbox --remote --file schema.sql
```

- [ ] **Step 2: 設 watchdog secrets**

```bash
cd watchdog
npx wrangler secret put TELEGRAM_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

- [ ] **Step 3: 首次手動 deploy 驗證**

```bash
cd api && npx wrangler deploy
# 測:POST 建一筆、開短網址確認 302
```

### Task 6.2: Pages + Web Analytics + 真實點擊聚合

- [ ] **Step 1: 在 Cloudflare Pages 接 GitHub repo,build 指令指向 `site/`,設 `PUBLIC_API_URL` 環境變數指到 api Worker 網域。**

- [ ] **Step 2: 開 Cloudflare Web Analytics,把 beacon 加到 `site` 的 layout。**

- [ ] **Step 3: 產 account-level API token,接 Analytics Engine SQL API,讓 `/api/stats` 回真實點擊聚合(用 Task 2.1 的 `buildStatsQuery`),`fetchMetrics()` 同樣接上。**

- [ ] **Step 4: 確認儀表板顯示真實數字、watchdog 告警能進 Telegram(暫時調低門檻測一次)→ 提交。**

### Task 6.3:(可選)自訂網域

- [ ] **Step 1: 若買網域 → Cloudflare 加站、Pages 與 Worker 綁自訂網域。否則用 `*.pages.dev` / `*.workers.dev`。**

---

## Self-Review 結果

- **Spec 覆蓋**:site/api/db/metrics/watchdog/ci 六組件皆有對應 Task ✅;錯誤處理(400/404/埋點不阻轉址)在 Task 1.2/2.1 ✅;測試策略(單元+整合+CI 關卡)在 Phase 1/5 ✅。
- **已知刻意延後**:Analytics Engine 真實聚合與 `fetchMetrics` 在 Phase 6 接上(需部署後的 account token),MVP 先回安全值——已於對應 Task 標註,非 placeholder。
- **型別一致**:`makeSlug`/`isValidUrl`/`buildStatsQuery`/`shouldAlert`/`Env`/`Metrics` 命名前後一致 ✅。
- **待 Derek 決定**:正式名稱、是否現在買網域。
