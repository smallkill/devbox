# 作品集重新設計(亮色 + 雙語 + 內容集)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 site/ 從深色終端機風改成乾淨亮色技術文件風,支援中英 i18n 路由,內容用 Astro Content Collections(專案/經歷各一檔 + 截圖),首版含 devbox 範例專案與重新配色的 /status。

**Architecture:** Astro i18n routing(zh 於 `/`、en 於 `/en`,`prefixDefaultLocale:false`)。內容存 `src/content/{projects,experience}/{zh,en}/<slug>.md`,zh 必填、en 缺則回退 zh。共用亮色 `Base.astro` 設計系統 + 小元件。頁面由 collection 動態產生。驗證以 `astro build` + Playwright 截圖為主;i18n 回退邏輯有單元測試。

**Tech Stack:** Astro 5(content collections + i18n)、TypeScript、Vitest(i18n helper)、Playwright(視覺驗證)。

**驗證慣例:** 每個 Task 末尾跑 `cd site && npx astro build`(必須成功),視覺類另以 Playwright 截圖人眼確認。

---

## 檔案結構

```
site/
├── astro.config.mjs              # 加 i18n 設定
├── src/
│   ├── content.config.ts         # projects/experience collection schema(zod)
│   ├── i18n/
│   │   ├── ui.ts                 # UI 字串(nav/labels)zh/en
│   │   └── content.ts            # getLocalizedEntries():取某 locale 內容,缺則回退 zh
│   │   └── content.test.ts       # 回退邏輯單元測試
│   ├── layouts/Base.astro        # 亮色設計系統(取代深色版)
│   ├── components/
│   │   ├── LangToggle.astro
│   │   ├── ProjectCard.astro
│   │   ├── ExperienceItem.astro
│   │   └── Figure.astro          # 截圖:淡邊框+圓角+caption
│   ├── content/
│   │   ├── projects/{zh,en}/devbox.md
│   │   └── experience/{zh,en}/*.md(占位)
│   ├── pages/
│   │   ├── index.astro           # 履歷主頁(zh)
│   │   ├── status.astro          # 儀表板(亮色重配)
│   │   ├── projects/[slug].astro # 詳情(zh)
│   │   └── en/
│   │       ├── index.astro
│   │       └── projects/[slug].astro
│   └── lib/resume.ts             # 履歷靜態資料(姓名/角色/連結/技能)zh/en
└── public/projects/devbox/       # devbox 截圖
```

---

## Phase 0 — i18n 設定 + 內容集 schema

### Task 0.1: Astro i18n 設定

**Files:** Modify `site/astro.config.mjs`

- [ ] **Step 1: 設定 i18n**

```js
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  i18n: {
    defaultLocale: "zh",
    locales: ["zh", "en"],
    routing: { prefixDefaultLocale: false },
  },
});
```

- [ ] **Step 2: build 驗證**

Run: `cd site && npx astro build`
Expected: 成功(現有頁面仍在,尚未動內容)。

- [ ] **Step 3: 提交** `git add site/astro.config.mjs && git commit -m "feat(site): enable astro i18n (zh default, en prefixed)"`

### Task 0.2: Content Collections schema

**Files:** Create `site/src/content.config.ts`

- [ ] **Step 1: 定義 schema**

```ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const projects = defineCollection({
  loader: glob({ pattern: "{zh,en}/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    role: z.string().optional(),
    org: z.string().optional(),
    period: z.string().optional(),
    tech: z.array(z.string()).default([]),
    cover: z.string().optional(),
    gallery: z.array(z.object({ src: z.string(), caption: z.string().optional() })).default([]),
    links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
    featured: z.boolean().default(false),
    order: z.number().default(99),
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: "{zh,en}/*.md", base: "./src/content/experience" }),
  schema: z.object({
    org: z.string(),
    role: z.string(),
    period: z.string(),
    tech: z.array(z.string()).default([]),
    order: z.number().default(99),
  }),
});

export const collections = { projects, experience };
```

> 註:glob loader 的 entry id 會是 `zh/devbox`、`en/devbox`。locale 與 slug 由 id 拆解(見 Task 0.3)。

- [ ] **Step 2: 建一個 devbox zh 內容檔** `site/src/content/projects/zh/devbox.md`

```md
---
title: devbox — 自架短網址 SaaS
role: 個人專案 · 全端 + DevOps
period: 2026
tech: ["Cloudflare Workers", "D1", "Analytics Engine", "GitHub Actions", "Astro", "TypeScript"]
cover: /projects/devbox/cover.png
gallery:
  - { src: /projects/devbox/status.png, caption: 即時監控儀表板 }
links:
  - { label: Live, href: "https://derek-chen.pages.dev" }
  - { label: GitHub, href: "https://github.com/smallkill/devbox" }
featured: true
order: 1
---

從 `git push` 到 CI/CD 自動部署到即時監控,全棧打通的短網址 SaaS。
Workers + D1 + Analytics Engine,Cron 告警,GitHub Actions 自動部署,
附即時點擊監控儀表板。展示自架 SaaS + DevOps + Observability 能力。
```

- [ ] **Step 3: build 驗證** `cd site && npx astro build` → 成功(collection 載入無 schema 錯)。
- [ ] **Step 4: 提交** `git add site/src/content.config.ts site/src/content/ && git commit -m "feat(site): content collections schema + devbox sample"`

### Task 0.3: i18n 內容回退 helper(TDD)

**Files:** Create `site/src/i18n/content.ts`, `site/src/i18n/content.test.ts`, `site/vitest.config.ts`, add vitest dep

- [ ] **Step 1: 寫失敗測試** `site/src/i18n/content.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { resolveLocalized } from "./content";

// 模擬 collection entries(id 形如 "zh/devbox")
const entries = [
  { id: "zh/devbox", data: { title: "中文" } },
  { id: "zh/foo", data: { title: "只有中文" } },
  { id: "en/devbox", data: { title: "English" } },
];

describe("resolveLocalized", () => {
  it("en 取 en 檔", () => {
    const r = resolveLocalized(entries, "en");
    expect(r.find((e) => e.slug === "devbox").data.title).toBe("English");
  });
  it("en 缺檔回退 zh,並標 fallback", () => {
    const r = resolveLocalized(entries, "en");
    const foo = r.find((e) => e.slug === "foo");
    expect(foo.data.title).toBe("只有中文");
    expect(foo.fallback).toBe(true);
  });
  it("zh 一律取 zh", () => {
    const r = resolveLocalized(entries, "zh");
    expect(r.map((e) => e.slug).sort()).toEqual(["devbox", "foo"]);
  });
});
```

- [ ] **Step 2: 加 vitest** `site/package.json` 加 devDep `vitest` 與 script `"test": "vitest run"`;建 `site/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

- [ ] **Step 3: 跑確認失敗** `cd site && npm install && npx vitest run` → FAIL(模組不存在)。

- [ ] **Step 4: 實作** `site/src/i18n/content.ts`

```ts
export interface RawEntry { id: string; data: Record<string, unknown>; body?: string; }
export interface LocalizedEntry { slug: string; data: Record<string, unknown>; body?: string; fallback: boolean; }

/** 取某 locale 的內容;缺該 locale 檔時回退 zh,並標 fallback=true。 */
export function resolveLocalized(entries: RawEntry[], locale: "zh" | "en"): LocalizedEntry[] {
  const byLocale = (loc: string) =>
    new Map(entries.filter((e) => e.id.startsWith(loc + "/")).map((e) => [e.id.slice(loc.length + 1), e]));
  const zh = byLocale("zh");
  const want = locale === "zh" ? zh : byLocale("en");
  const slugs = new Set([...zh.keys()]); // zh 為內容母體
  return [...slugs].map((slug) => {
    const hit = want.get(slug);
    const src = hit ?? zh.get(slug)!;
    return { slug, data: src.data, body: src.body, fallback: !hit && locale !== "zh" };
  });
}
```

- [ ] **Step 5: 跑確認通過** `cd site && npx vitest run` → PASS(3)。
- [ ] **Step 6: 提交** `git add site && git commit -m "feat(site): i18n content fallback helper (TDD)"`

---

## Phase 1 — 亮色設計系統 Base + 語言切換

### Task 1.1: 亮色 Base.astro(取代深色版)

**Files:** Modify `site/src/layouts/Base.astro`

- [ ] **Step 1: 重寫 Base** — props `{ title, lang, path }`;亮色設計 tokens、字體、header(含 LangToggle 插槽)、footer。設計系統:

```
--bg: #fafaf8;  --bg-elev: #ffffff;  --ink: #16181d;  --muted: #5b6168;
--line: #e6e4df;  --accent: #2447d6;  --accent-soft: #eef1fd;
--sans: "Public Sans", system-ui, "Noto Sans TC", sans-serif;
--mono: "Space Mono", ui-monospace, monospace;
```
字體用 Google Fonts(Public Sans + Space Mono + Noto Sans TC)。背景極淡網格或純色 + 細頂線。`prefers-reduced-motion` 尊重。`:focus-visible` 可見。max-width ~ 760–820px 置中、行高好讀。

- [ ] **Step 2: build + 截圖驗證**(此時頁面仍是舊內容,但 Base 換新)。確認亮色、字體、無 console error。
- [ ] **Step 3: 提交** `git commit -m "feat(site): light technical-docs design system"`

### Task 1.2: LangToggle 元件

**Files:** Create `site/src/components/LangToggle.astro`, `site/src/i18n/ui.ts`

- [ ] **Step 1: UI 字串** `site/src/i18n/ui.ts`

```ts
export const UI = {
  zh: { nav_projects: "專案", nav_status: "系統狀態", role: "Software / DevOps Engineer", experience: "經歷", skills: "技能", projects: "精選專案", fallback: "中文" },
  en: { nav_projects: "Projects", nav_status: "Status", role: "Software / DevOps Engineer", experience: "Experience", skills: "Skills", projects: "Selected Projects", fallback: "ZH" },
} as const;
export type Locale = keyof typeof UI;
```

- [ ] **Step 2: LangToggle** — 接 `lang` 與目前 `path`,輸出 zh/en 兩鏈結,對應切換(zh→去掉 /en、en→加 /en),目前語言 highlight,寫 localStorage。

```astro
---
const { lang, path } = Astro.props;
// path 是不含 locale 前綴的純路徑(如 "/"、"/projects/devbox")
const zhHref = path;
const enHref = "/en" + (path === "/" ? "" : path);
---
<nav class="lang" aria-label="language">
  <a href={zhHref} class={lang === "zh" ? "on" : ""} hreflang="zh">中</a>
  <span>/</span>
  <a href={enHref} class={lang === "en" ? "on" : ""} hreflang="en">EN</a>
</nav>
<script>
  document.querySelectorAll('.lang a').forEach((a) =>
    a.addEventListener('click', () => localStorage.setItem('lang', a.hreflang)));
</script>
```

- [ ] **Step 3: 接進 Base header**,build 驗證。
- [ ] **Step 4: 提交** `git commit -m "feat(site): language toggle + ui strings"`

---

## Phase 2 — 內容元件

### Task 2.1: Figure(截圖)、ProjectCard、ExperienceItem

**Files:** Create `site/src/components/Figure.astro`, `ProjectCard.astro`, `ExperienceItem.astro`

- [ ] **Step 1: Figure.astro** — `{ src, caption }`,淡邊框 + 圓角 + 輕陰影 + 等寬 caption;`loading="lazy"`、有 `alt`。
- [ ] **Step 2: ProjectCard.astro** — `{ href, title, role, period, tech, cover, fallback }`;縮圖 + 標題 + 角色/期間 + tech chips;hover 細微抬升;fallback 時角落標 UI.fallback。
- [ ] **Step 3: ExperienceItem.astro** — `{ org, role, period, tech, body }`;時間軸列、等寬 period、左側 hairline。
- [ ] **Step 4: build 驗證 + 提交** `git commit -m "feat(site): figure / project-card / experience-item components"`

---

## Phase 3 — 履歷主頁(zh + en)

### Task 3.1: 履歷靜態資料

**Files:** Create `site/src/lib/resume.ts`

- [ ] **Step 1:** 雙語靜態資料(姓名、role、一句話定位、連結、技能分組)。

```ts
export const RESUME = {
  name: "Derek Chen",
  links: [
    { label: "GitHub", href: "https://github.com/smallkill" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/…" },
  ],
  intro: {
    zh: "以 Cloudflare 為核心的 Software / DevOps 工程師,自架生產級 SaaS:CI/CD 自動部署、Infrastructure-as-Code、可觀測性優先。",
    en: "Software / DevOps engineer building production SaaS on Cloudflare — automated CI/CD, infrastructure-as-code, observability-first.",
  },
  skills: [
    { group: "Cloud / Infra", items: ["Cloudflare Workers", "Pages", "D1", "GCP", "Terraform"] },
    { group: "Engineering", items: ["TypeScript", "CI/CD (GitHub Actions)", "TDD", "Observability"] },
  ],
};
```

> LinkedIn URL 待 Derek 提供,先放占位 `https://www.linkedin.com/in/`(實作時若無則該連結省略,不留壞鏈)。

- [ ] **Step 2: 提交** `git commit -m "feat(site): resume static data"`

### Task 3.2: 履歷頁(共用 render,zh 與 en 各一入口)

**Files:** Create `site/src/pages/index.astro`、`site/src/pages/en/index.astro`(共用一個 `ResumePage.astro` 或 render 函式避免重複)

- [ ] **Step 1: 共用版型** — 建 `site/src/components/Resume.astro`(接 `lang`),內含:header(名/role/links/LangToggle)、intro、經歷(用 `resolveLocalized(experience, lang)` + ExperienceItem)、技能、精選專案(`resolveLocalized(projects, lang)` 篩 featured + ProjectCard)。
- [ ] **Step 2:** `pages/index.astro` 用 `<Resume lang="zh" />`;`pages/en/index.astro` 用 `<Resume lang="en" />`。
- [ ] **Step 3: build + 雙語截圖驗證**(`/` 與 `/en` 都正確、切換鈕運作、devbox 卡出現)。
- [ ] **Step 4: 提交** `git commit -m "feat(site): bilingual résumé home page"`

---

## Phase 4 — 專案詳情頁(zh + en)

### Task 4.1: 詳情頁 + getStaticPaths

**Files:** Create `site/src/pages/projects/[slug].astro`、`site/src/pages/en/projects/[slug].astro`(共用 `ProjectDetail.astro`)

- [ ] **Step 1: 共用 `ProjectDetail.astro`** — 接 `{ entry, lang }`,渲染標題/角色/期間/tech/連結 + body(`<Content />`)+ gallery(Figure)。
- [ ] **Step 2: `[slug].astro` getStaticPaths** — 由 `resolveLocalized(projects, lang)` 產生每個 slug 的路徑,傳 entry。en 頁同理(缺 en 用回退 entry,頁面標 fallback)。
- [ ] **Step 3: build 驗證** — `/projects/devbox` 與 `/en/projects/devbox` 都生成且內容正確。
- [ ] **Step 4: 提交** `git commit -m "feat(site): bilingual project detail pages"`

---

## Phase 5 — /status 亮色重配

### Task 5.1: 儀表板套用亮色設計系統

**Files:** Modify `site/src/pages/status.astro`

- [ ] **Step 1:** 改用新 Base + 亮色 token;保留現有 JS(fetch `${PUBLIC_API_URL}/api/stats`、count-up、`#live-text`、AbortSignal timeout、指數退避、DOM-API renderTop)。把 metric 卡、console 表格改成亮色技術文件風(淡灰格線、墨藍強調、等寬數字)。`<style is:global>` 的動態表格樣式保留(Astro scope 限制)。
- [ ] **Step 2: build + 截圖驗證** — 數字 count-up、share 長條、live 指示、中英(若 nav 有)正常;主控台無 error。
- [ ] **Step 3: 提交** `git commit -m "feat(site): restyle status dashboard to light theme"`

---

## Phase 6 — 收尾:截圖素材、build、部署

### Task 6.1: devbox 截圖素材

**Files:** Create `site/public/projects/devbox/{cover,status}.png`

- [ ] **Step 1:** 用 Playwright 對 live `/status` 截圖當 `status.png`;cover 用首頁截圖或一張代表圖。放入 `public/projects/devbox/`。
- [ ] **Step 2: build 驗證** 圖片路徑正確、詳情頁 gallery 顯示。
- [ ] **Step 3: 提交** `git commit -m "chore(site): devbox project screenshots"`

### Task 6.2: 全站 build + 部署 + 視覺驗收

- [ ] **Step 1:** `cd site && PUBLIC_API_URL=https://devbox-api.chinte-cheng.workers.dev npm run build` → 成功。
- [ ] **Step 2:** `npx wrangler pages deploy dist --project-name derek-chen --branch main --commit-dirty=true`。
- [ ] **Step 3:** Playwright 截圖 `/`、`/en`、`/projects/devbox`、`/status`(亮色),人眼確認可讀、雙語、截圖呈現、無 error。
- [ ] **Step 4:** 跑 `cd site && npx vitest run`(i18n helper)+ `npx astro build` 綠;`git commit -m "chore(site): build + deploy redesign"` 並 `git push`(CI 跑 api;site 已手動部署)。

---

## Self-Review

- **Spec 覆蓋:** 視覺(Phase 1)✅、Content Collections(0.2)✅、i18n 路由+回退(0.1/0.3/3/4)✅、結構 `/`·`/projects/<slug>`·`/status`(3/4/5)✅、元件分解(2)✅、devbox 範例(0.2/6.1)✅、工作流(文件/spec)✅。
- **Placeholder:** LinkedIn URL 與 Base/元件的細部 CSS 為實作時定——已明確標註處理方式(無 URL 則省略連結;CSS 依設計 token + 截圖驗收),非未決 placeholder。
- **型別一致:** `resolveLocalized` 回傳 `{slug,data,body,fallback}` 於 Phase 3/4 一致使用;collection 名 `projects`/`experience`、UI key 前後一致。
- **已知刻意延後:** experience 占位內容、圖片最佳化(Astro `<Image>`)留待內容變多——非缺陷。
