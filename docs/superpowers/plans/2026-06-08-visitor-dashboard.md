# 真實訪客儀表板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/status` 加「訪客」區塊,顯示真實的累計頁面瀏覽數、今日不重複訪客、來訪國家 Top。

**Architecture:** 靜態站每頁載入打 fire-and-forget beacon `GET /api/visit`;api Worker 算 `sha256(ip+salt+day)` 雜湊與 `request.cf.country`,寫一列 D1 `visits` 表;`GET /api/stats` 擴充回 `visitors` 彙整;Status.astro 渲染。隱私只存雜湊、不存原始 IP。

**Tech Stack:** Cloudflare Workers + D1、Astro(Pages)、TypeScript、Vitest(@cloudflare/vitest-pool-workers + miniflare D1)。

**分支:** `feat/visitor-dashboard`(已建)。專案根 `/home/derek/projects/devbox`,api workspace 在 `api/`。

---

### Task 1: visits.ts 純函式(utcDay / hashIp)

**Files:**
- Create: `api/src/visits.ts`
- Test: `api/test/visits.test.ts`

- [ ] **Step 1: 寫失敗測試** — Create `api/test/visits.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { utcDay, hashIp } from "../src/visits";

describe("utcDay", () => {
  it("回 YYYY-MM-DD(UTC)", () => {
    expect(utcDay(0)).toBe("1970-01-01");
    expect(utcDay(Date.UTC(2026, 5, 8, 23, 59))).toBe("2026-06-08");
  });
});

describe("hashIp", () => {
  it("決定性:同輸入同輸出", async () => {
    const a = await hashIp("1.2.3.4", "salt", "2026-06-08");
    const b = await hashIp("1.2.3.4", "salt", "2026-06-08");
    expect(a).toBe(b);
  });
  it("不同 ip / day 產生不同雜湊", async () => {
    const base = await hashIp("1.2.3.4", "salt", "2026-06-08");
    expect(await hashIp("9.9.9.9", "salt", "2026-06-08")).not.toBe(base);
    expect(await hashIp("1.2.3.4", "salt", "2026-06-09")).not.toBe(base);
  });
  it("輸出為 64 字元 hex 且不含原始 ip", async () => {
    const h = await hashIp("1.2.3.4", "salt", "2026-06-08");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("1.2.3.4");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd api && npx vitest run visits`
Expected: FAIL（`../src/visits` 不存在）

- [ ] **Step 3: 實作** — Create `api/src/visits.ts`:

```ts
// 訪客埋點與彙整。純函式(utcDay / hashIp)可單元測試;D1 存取在 recordVisit / fetchVisitStats。

/** ts(毫秒)→ 'YYYY-MM-DD'(UTC)。 */
export function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** sha256(ip|salt|day) → hex;不可逆,含每日 salt 故跨日不可關聯。不存原始 ip。 */
export async function hashIp(ip: string, salt: string, day: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${salt}|${day}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd api && npx vitest run visits`
Expected: PASS（7 個 assertion 綠）

- [ ] **Step 5: Commit**

```bash
git add api/src/visits.ts api/test/visits.test.ts
git commit -m "feat(api): visits pure helpers (utcDay, hashIp) — TDD"
```

---

### Task 2: D1 schema + Env.VISIT_SALT + 測試 binding

**Files:**
- Modify: `api/schema.sql`
- Modify: `api/src/index.ts`(Env 介面)
- Modify: `api/vitest.config.ts`
- Modify: `api/wrangler.toml`(註解)

- [ ] **Step 1: 追加 visits 表** — 在 `api/schema.sql` 末尾加:

```sql

CREATE TABLE IF NOT EXISTS visits (
  ts      INTEGER NOT NULL,
  day     TEXT    NOT NULL,
  ip_hash TEXT    NOT NULL,
  country TEXT,
  path    TEXT
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);
```

- [ ] **Step 2: Env 加 VISIT_SALT** — `api/src/index.ts` 的 `Env` 介面,在 `AE_API_TOKEN?: string;` 後加一行:

```ts
  // 訪客 IP 雜湊用的 salt(wrangler secret put VISIT_SALT)。
  VISIT_SALT?: string;
```

- [ ] **Step 3: 測試 binding** — `api/vitest.config.ts` 的 `miniflare.bindings` 改成:

```ts
        miniflare: {
          bindings: { CREATE_TOKEN: "test-token", VISIT_SALT: "test-salt" },
        },
```

- [ ] **Step 4: wrangler.toml 註解** — 在 `api/wrangler.toml` 既有 secret 註解區塊(`#   wrangler secret put CF_ACCOUNT_ID ...` 那段)後加一行:

```
#   wrangler secret put VISIT_SALT     # 訪客 IP 雜湊 salt(隨機字串)
```

- [ ] **Step 5: typecheck + 既有測試不破** —

Run: `cd ~/projects/devbox && npm run typecheck && cd api && npx vitest run`
Expected: typecheck 0 錯;既有測試全綠（schema/Env/config 改動不影響行為）

- [ ] **Step 6: Commit**

```bash
git add api/schema.sql api/src/index.ts api/vitest.config.ts api/wrangler.toml
git commit -m "feat(api): visits D1 schema + VISIT_SALT env/binding"
```

---

### Task 3: visits.ts D1 層(recordVisit / fetchVisitStats)

**Files:**
- Modify: `api/src/visits.ts`
- Modify: `api/test/visits.test.ts`

- [ ] **Step 1: 寫失敗測試** — 在 `api/test/visits.test.ts` 末尾加(注意:這些測試用 `cloudflare:test` 的 `env`,在 Workers runtime 跑):

```ts
import { env } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";
import { recordVisit, fetchVisitStats } from "../src/visits";

beforeAll(async () => {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS visits (ts INTEGER NOT NULL, day TEXT NOT NULL, ip_hash TEXT NOT NULL, country TEXT, path TEXT)",
  );
});
beforeEach(async () => {
  await env.DB.exec("DELETE FROM visits");
});

describe("recordVisit + fetchVisitStats", () => {
  it("同 ip 打兩次:views=2、uniqueToday=1", async () => {
    await recordVisit(env, "1.2.3.4", "TW", "/");
    await recordVisit(env, "1.2.3.4", "TW", "/ask");
    const s = await fetchVisitStats(env);
    expect(s?.views).toBe(2);
    expect(s?.uniqueToday).toBe(1);
  });

  it("不同國家:topCountries 依次數遞減", async () => {
    await recordVisit(env, "1.1.1.1", "TW", "/");
    await recordVisit(env, "2.2.2.2", "TW", "/");
    await recordVisit(env, "3.3.3.3", "JP", "/");
    const s = await fetchVisitStats(env);
    expect(s?.topCountries[0]).toEqual({ country: "TW", n: 2 });
    expect(s?.topCountries[1]).toEqual({ country: "JP", n: 1 });
  });

  it("country 空字串不進 topCountries", async () => {
    await recordVisit(env, "1.1.1.1", "", "/");
    const s = await fetchVisitStats(env);
    expect(s?.views).toBe(1);
    expect(s?.topCountries).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd api && npx vitest run visits`
Expected: FAIL（`recordVisit` / `fetchVisitStats` 未匯出）

- [ ] **Step 3: 實作** — 在 `api/src/visits.ts` 末尾加:

```ts
export interface CountryCount {
  country: string;
  n: number;
}
export interface VisitStats {
  views: number;
  uniqueToday: number;
  topCountries: CountryCount[];
}
export interface VisitEnv {
  DB: D1Database;
  VISIT_SALT?: string;
}

/** 寫一筆訪問。country/path 可空。 */
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

/** 彙整:累計瀏覽、今日不重複、國家 Top 6。失敗回 null(呼叫端降級)。 */
export async function fetchVisitStats(env: VisitEnv): Promise<VisitStats | null> {
  try {
    const today = utcDay(Date.now());
    const [views, uniq, countries] = await Promise.all([
      env.DB.prepare("SELECT count(*) AS n FROM visits").first<{ n: number }>(),
      env.DB.prepare(
        "SELECT count(DISTINCT ip_hash) AS n FROM visits WHERE day = ?",
      )
        .bind(today)
        .first<{ n: number }>(),
      env.DB.prepare(
        "SELECT country, count(*) AS n FROM visits WHERE country IS NOT NULL AND country != '' GROUP BY country ORDER BY n DESC LIMIT 6",
      ).all<{ country: string; n: number }>(),
    ]);
    return {
      views: views?.n ?? 0,
      uniqueToday: uniq?.n ?? 0,
      topCountries: (countries.results ?? []).map((r) => ({
        country: String(r.country),
        n: Number(r.n),
      })),
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd api && npx vitest run visits`
Expected: PASS（含 Task 1 的純函式測試,全綠）

- [ ] **Step 5: Commit**

```bash
git add api/src/visits.ts api/test/visits.test.ts
git commit -m "feat(api): recordVisit + fetchVisitStats (D1) — TDD"
```

---

### Task 4: `GET /api/visit` beacon 路由

**Files:**
- Modify: `api/src/index.ts`
- Modify: `api/test/routes.test.ts`

- [ ] **Step 1: 寫失敗測試** — 在 `api/test/routes.test.ts` 的 `beforeAll` 內,於建 links 表後加建 visits 表:

```ts
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS visits (ts INTEGER NOT NULL, day TEXT NOT NULL, ip_hash TEXT NOT NULL, country TEXT, path TEXT)",
  );
```

接著在檔案末尾加:

```ts
describe("GET /api/visit", () => {
  it("回 204 並帶 CORS", async () => {
    const res = await SELF.fetch("https://x/api/visit?path=/");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd api && npx vitest run routes`
Expected: FAIL（目前 `/api/visit` 走到 fallback,回 200 而非 204）

- [ ] **Step 3: 實作** — `api/src/index.ts` 頂部 import 改成:

```ts
import { makeSlug, isValidUrl } from "./slug";
import { fetchClickStats } from "./stats";
import { recordVisit, fetchVisitStats } from "./visits";
```

在轉址處理(`if (req.method === "GET" && SLUG_RE.test(path))`)**之前**插入:

```ts
    // 訪客埋點 beacon:寫一筆訪問,一律回 204(fire-and-forget,不可報錯)。
    if (req.method === "GET" && path === "/api/visit") {
      try {
        const ip = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
        const country =
          (req as unknown as { cf?: { country?: string } }).cf?.country ?? "";
        const visitedPath = (url.searchParams.get("path") ?? "").slice(0, 256);
        await recordVisit(env, ip, country, visitedPath);
      } catch {
        /* 寧可漏記一筆,不報錯 */
      }
      return new Response(null, {
        status: 204,
        headers: { "access-control-allow-origin": "*" },
      });
    }
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd api && npx vitest run routes`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/src/index.ts api/test/routes.test.ts
git commit -m "feat(api): GET /api/visit beacon endpoint"
```

---

### Task 5: `/api/stats` 擴充 visitors 區塊

**Files:**
- Modify: `api/src/index.ts`
- Modify: `api/test/routes.test.ts`

- [ ] **Step 1: 寫失敗測試** — 在 `api/test/routes.test.ts` 末尾加:

```ts
describe("GET /api/stats — visitors 區塊", () => {
  it("打一次 visit 後 stats 的 visitors.views >= 1", async () => {
    await SELF.fetch("https://x/api/visit?path=/");
    const res = await SELF.fetch("https://x/api/stats");
    const body = await res.json<{
      visitors: { views: number; uniqueToday: number; topCountries: unknown[] } | null;
    }>();
    expect(body.visitors).not.toBeNull();
    expect(body.visitors!.views).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.visitors!.topCountries)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd api && npx vitest run routes`
Expected: FAIL（回應目前無 `visitors` 欄,`body.visitors` 為 undefined → `not.toBeNull` 過但 `body.visitors!.views` throw / undefined）

- [ ] **Step 3: 實作** — `api/src/index.ts` 的 `/api/stats` 區塊改成(加 `fetchVisitStats`):

```ts
    if (req.method === "GET" && path === "/api/stats") {
      const total = await env.DB.prepare(
        "SELECT count(*) AS n FROM links",
      ).first<{ n: number }>();
      // 真實點擊指標;AE 未設定或查詢失敗時為 null,前端自行降級。
      const clicks = await fetchClickStats(env, CLICKS_DATASET);
      // 訪客彙整;D1 查詢失敗回 null,前端降級。
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd api && npx vitest run`
Expected: PASS（全部 api 測試綠）

- [ ] **Step 5: Commit**

```bash
git add api/src/index.ts api/test/routes.test.ts
git commit -m "feat(api): include visitors block in /api/stats"
```

---

### Task 6: site Base.astro 訪客 beacon

**Files:**
- Modify: `site/src/layouts/Base.astro`

- [ ] **Step 1: 加 apiUrl 到 frontmatter** — `site/src/layouts/Base.astro` 的 frontmatter(`const base = ...` 那行後)加:

```ts
// 訪客埋點 beacon 的 API 網域(部署時 PUBLIC_API_URL 注入,本機留空=同源)。
const apiUrl = import.meta.env.PUBLIC_API_URL ?? "";
```

- [ ] **Step 2: 加 beacon script** — 在 `</body>` 之前(footer `</footer>` 之後)加:

```astro
    <script define:vars={{ apiUrl }}>
      // 訪客埋點:fire-and-forget,失敗無感,絕不阻擋頁面。
      try {
        fetch(`${apiUrl}/api/visit?path=` + encodeURIComponent(location.pathname), {
          method: "GET",
          mode: "no-cors",
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    </script>
```

- [ ] **Step 3: build 驗證**

Run: `cd site && npm run build`
Expected: build 成功;`grep -rl "api/visit" dist | head` 應找到頁面(beacon 已注入)

- [ ] **Step 4: Commit**

```bash
git add site/src/layouts/Base.astro
git commit -m "feat(site): visitor beacon on every page load"
```

---

### Task 7: ui.ts 字串 + Status.astro 訪客 UI

**Files:**
- Modify: `site/src/i18n/ui.ts`
- Modify: `site/src/components/Status.astro`

- [ ] **Step 1: ui.ts 加字串** — 在 `zh` 物件的 `st_conn_failed` 後加:

```ts
    vs_views: "總瀏覽",
    vs_unique_today: "今日不重複訪客",
    vs_countries: "來訪國家 · Top",
    vs_no_visitors: "尚無訪客",
```

在 `en` 物件的 `st_conn_failed` 後加:

```ts
    vs_views: "Page views",
    vs_unique_today: "Unique today",
    vs_countries: "Top countries",
    vs_no_visitors: "no visitors yet",
```

- [ ] **Step 2: Status.astro — txt 加 noVisitors** — `const txt = { ... }` 改成:

```ts
const txt = {
  noClicks: t.st_no_clicks,
  lastSync: t.st_last_sync,
  connFailed: t.st_conn_failed,
  noVisitors: t.vs_no_visitors,
};
```

- [ ] **Step 3: Status.astro — grid 加兩個訪客指標** — 把既有 `<div class="grid">...</div>`(links + clicks 兩格)改成四格:

```astro
<div class="grid">
  <div class="metric">
    <span class="m-label">{t.st_short_links}</span>
    <span class="m-val" id="links" data-v="0">—</span>
    <span class="m-unit">links total</span>
  </div>
  <div class="metric accent">
    <span class="m-label">{t.st_clicks24h}</span>
    <span class="m-val" id="clicks" data-v="0">—</span>
    <span class="m-unit">clicks / 24h</span>
  </div>
  <div class="metric">
    <span class="m-label">{t.vs_views}</span>
    <span class="m-val" id="views" data-v="0">—</span>
    <span class="m-unit">page views</span>
  </div>
  <div class="metric accent">
    <span class="m-label">{t.vs_unique_today}</span>
    <span class="m-val" id="unique" data-v="0">—</span>
    <span class="m-unit">unique today</span>
  </div>
</div>
```

- [ ] **Step 4: Status.astro — 加國家區塊** — 在 `<section class="topwrap">...</section>`(top links)**之後**加另一個區塊:

```astro
<section class="topwrap">
  <h2>{t.vs_countries}</h2>
  <div class="console">
    <div class="console-bar"><code>SELECT country, count() GROUP BY country</code></div>
    <ul id="countries" class="ctry"><li class="muted">{t.st_querying}</li></ul>
  </div>
</section>
```

- [ ] **Step 5: Status.astro — 國家清單樣式** — 在既有 `<style is:global>`(`.console table { ... }` 那個區塊)末尾、`</style>` 之前加:

```css
  .console ul.ctry { list-style: none; margin: 0; padding: 0.4rem 0; }
  .console ul.ctry li { display: flex; align-items: center; gap: 0.7rem; padding: 0.5rem 0.9rem; border-bottom: 1px solid var(--line); }
  .console ul.ctry li:last-child { border-bottom: none; }
  .console ul.ctry .flag { font-size: 1.1rem; }
  .console ul.ctry .cc { font-family: var(--mono); font-size: 0.8rem; color: var(--ink-soft); width: 2.2rem; }
  .console ul.ctry .bar { flex: 0 0 auto; }
  .console ul.ctry .cn { margin-left: auto; font-family: var(--mono); font-size: 0.82rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .console ul.ctry li.muted { color: var(--muted); justify-content: flex-start; }
```

- [ ] **Step 6: Status.astro — client script:render + tick** — 在 client script 內,`renderTop` 函式後加 `flag` + `renderCountries`:

```js
  function flag(cc) {
    if (!/^[A-Za-z]{2}$/.test(cc)) return "🌐";
    const b = 0x1f1e6, u = cc.toUpperCase();
    return String.fromCodePoint(b + u.charCodeAt(0) - 65, b + u.charCodeAt(1) - 65);
  }

  function renderCountries(rows) {
    const box = $("countries");
    if (!Array.isArray(rows) || rows.length === 0) {
      const li = document.createElement("li");
      li.className = "muted"; li.textContent = txt.noVisitors;
      box.replaceChildren(li);
      return;
    }
    const max = Math.max(...rows.map((r) => Number(r.n) || 0), 1);
    box.replaceChildren(...rows.map((r) => {
      const li = document.createElement("li");
      const f = document.createElement("span"); f.className = "flag"; f.textContent = flag(r.country);
      const cc = document.createElement("span"); cc.className = "cc"; cc.textContent = r.country;
      const bar = document.createElement("span"); bar.className = "bar";
      bar.style.width = Math.max(6, (Number(r.n) / max) * 120) + "px";
      const cn = document.createElement("span"); cn.className = "cn"; cn.textContent = String(r.n);
      li.append(f, cc, bar, cn);
      return li;
    }));
  }
```

- [ ] **Step 7: Status.astro — tick 內讀 visitors** — 在 `tick()` 的 `renderTop(d.topLinks);` 後加:

```js
      countTo($("views"), Number(d.visitors?.views) || 0);
      countTo($("unique"), Number(d.visitors?.uniqueToday) || 0);
      renderCountries(d.visitors?.topCountries);
```

- [ ] **Step 8: build 驗證**

Run: `cd site && npm run build`
Expected: build 成功,`/status` 與 `/en/status` 都產出

- [ ] **Step 9: Commit**

```bash
git add site/src/i18n/ui.ts site/src/components/Status.astro
git commit -m "feat(site): visitor metrics + top countries on /status"
```

---

### Task 8: 部署前置 — 遠端 D1 migration + VISIT_SALT secret(人工/controller 執行)

> 這步動到正式環境,由 controller 在所有 code 任務完成 + review 後執行,不在 subagent 內做。

- [ ] **Step 1: 套遠端 D1 schema**(`IF NOT EXISTS` 冪等,不動既有 links)

```bash
cd ~/projects/devbox/api && npx wrangler d1 execute devbox --remote --file schema.sql
```

- [ ] **Step 2: 設 VISIT_SALT secret**

```bash
cd ~/projects/devbox/api && npx wrangler secret put VISIT_SALT
# 貼一段隨機字串(例:openssl rand -hex 16 的輸出)
```

- [ ] **Step 3: 部署 api**(或靠 CI:push main 後 CI 自動 deploy api)

```bash
cd ~/projects/devbox/api && npx wrangler deploy
```

- [ ] **Step 4: 人工驗收** — 瀏覽正式站幾頁 → 開 `/status` 確認「總瀏覽 / 今日不重複 / 國家 Top」有數字且遞增。

---

## 注意事項

- **vitest isolatedStorage**:每個測試檔有獨立 D1。`visits.test.ts` 與 `routes.test.ts` 各自在 `beforeAll` 建 visits 表;`visits.test.ts` 用 `beforeEach` 清表確保計數測試乾淨。
- **`req.cf` 在測試/本機為 undefined** → country 退回 `""`,流程仍可跑(已在 Task 4 程式與 Task 3 測試涵蓋)。
- **`Date.now()` 在 Worker / 測試中可用**(僅 Workflow 工具腳本受限,本專案是一般 Worker code)。
- **beacon 用 `mode: "no-cors"`**:請求照常送達 Worker(side effect 寫入成立),回應為 opaque、前端不需讀。Worker 仍設 `access-control-allow-origin: *` 供日後改一般 fetch。
- **不做去重**:同人同頁多次載入都計入「總瀏覽」(符合 page views 語意);unique 才用 ip_hash 去重。
