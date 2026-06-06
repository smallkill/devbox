# 作品集網站重新設計(乾淨亮色 + 雙語 + 內容集)設計文件

> 日期:2026-06-06 ・ 作者:Derek Chen(NOVA 協助) ・ 狀態:已核可,待轉實作計劃

## 目標

把現有的「深色終端機/磷光綠」前端,改成**乾淨亮色的技術文件風**:低調、好讀、有工程師感,讓 recruiter 能 5 秒讀懂 Derek 是誰。支援**中英切換**,並能**隨時間慢慢加入專案 + 大量截圖**而不需改版型。

## 設計決策

### 1. 視覺方向:乾淨亮色 / 技術文件風
- 米白底(#fafaf9 系)、大量留白、細灰 hairline 分隔。
- 一個克制的強調色(墨藍 ink,如 #1d4ed8 系或更沉的靛),其餘黑白灰。
- Body 用好讀且有個性的 sans;heading 可同字族不同粗細;**metadata/標籤用等寬字**點工程感。
- 截圖統一加**淡邊框 + 圓角 + 輕陰影**,在亮底很跳。
- 不要 neon/glow/掃描線。動效克制(淡入即可,尊重 prefers-reduced-motion)。
- 無障礙:對比 ≥ AA、focus-visible、語意標籤。

### 2. 內容架構:Astro Content Collections
內容與版型分離,讓 Derek 能無痛新增。

- **collections:**
  - `experience`:工作/求職經歷(公司、角色、期間、重點)。
  - `projects`:做過的專案(標題、角色、技術、期間、封面圖、截圖集、寫作內容)。
- **每筆 = 一個 Markdown 檔**;frontmatter 放結構化欄位,body 放寫作內容。
- **截圖**放 `site/public/projects/<slug>/`,於該筆引用。
- 首頁與詳情頁自動渲染 collection 內容 → **新增一個專案 = 新增一個檔,版型不動**。

### 3. 中英切換:Astro i18n 路由
- 預設中文於 `/`,英文於 `/en`(`prefixDefaultLocale: false`)。
- 右上角語言切換鈕,偏好記 localStorage,切換時導到對應 locale 路徑。
- **可分享英文網址給國際 recruiter**(Derek 有 LinkedIn),SEO 友善。
- **儲存與 fallback(單一做法):** 每筆內容**一個 locale 一個檔**,依語言分目錄:
  - `src/content/projects/zh/<slug>.md`、`src/content/projects/en/<slug>.md`(experience 同理)。
  - frontmatter 與 body 皆為該語言。
  - **zh 必填、en 選填**;渲染 `/en` 時若某 slug 無 en 檔,**回退用 zh 檔**並標一個小 "中文" tag,不讓頁面破。
  - slug 跨語言一致(用同一 slug 串接 zh/en 與 `/projects/<slug>` 路由)。

### 4. 網站結構
| 路徑 | 內容 |
|---|---|
| `/`(`/en`) | 履歷主頁:姓名/角色/連結 + 一句話定位 + 經歷時間軸 + 技能 + 精選專案縮圖卡 |
| `/projects/<slug>`(`/en/projects/<slug>`) | 專案詳情:做了什麼 + 截圖集 + 技術/角色/連結 |
| `/status` | 保留 devbox 即時監控儀表板,改成新的乾淨亮色風格(沿用現有 fetch/降級/XSS-safe 邏輯) |

### 5. 元件分解(各自單一職責)
- `layouts/Base.astro`:亮色設計系統(字體、變數、背景、語言切換鈕、共用 head)。取代現有深色 Base。
- `components/LangToggle.astro`、`components/ProjectCard.astro`、`components/Screenshot.astro`、`components/ExperienceItem.astro`。
- `content/config.ts`:定義 `experience`、`projects` collection schema(zod)。
- `pages/index.astro` + `pages/en/index.astro`(或用 `[...locale]` 動態):履歷主頁。
- `pages/projects/[slug].astro`(+ en):詳情頁,getStaticPaths 由 collection 產生。
- `pages/status.astro`:重新配色的儀表板。

## 內容工作流(Derek 怎麼餵)
- **一次一個**專案/經歷,丟文字(可直接貼 Yourator/104/LinkedIn)+ 截圖。
- NOVA 轉成雙語結構化檔、存圖、配置;Derek 看順了再下一塊。
- 中文先有即可,英文之後補(缺英文自動回退中文)。

## 範圍(首版交付)
- 完整版型 + 雙語路由 + 設計系統 + **一個範例專案(devbox 本身,含現有截圖)** + 重新配色的 `/status`。
- 經歷/技能先放 Derek 現有的占位內容,之後逐步替換。

## 非目標(YAGNI)
- CMS / 後台、留言、深色模式切換、動畫特效、blog。先不做。

## 風險/待確認
- 等寬與 sans 字體選擇於實作時定(避免 Inter 等過於通用;heading 找有個性但好讀者)。
- 大量截圖的圖片最佳化(尺寸/格式)留待內容變多時再處理(可用 Astro `<Image>`)。
