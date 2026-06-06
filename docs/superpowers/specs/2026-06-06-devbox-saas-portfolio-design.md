# devbox — 自架 SaaS 作品集 設計文件

> 日期:2026-06-06 ・ 作者:Derek (NOVA 協助) ・ 狀態:已核可,待轉實作計劃

## 目標

一個短網址 SaaS,從 `git push` 到上線到監控全自動,履歷同站展示。同時達成兩個目的:

1. **對外作品集** — 讓面試官/HR 看到完整工程能力:live 的 SaaS、可見的 CI/CD pipeline、監控儀表板、履歷。
2. **自我練技** — 親手把 Cloudflare 全家桶 + CI/CD + observability 整套跑通。

## 非目標(YAGNI — 這版不做)

- 使用者登入 / 多租戶 / 帳號系統
- 付費 / 計費
- 進階分析(自訂網域分析、漏斗等)
- 外接 Grafana / Sentry(留作後續擴充,成本低)

## 架構

全部部署在 Cloudflare,程式碼在 GitHub。

```
GitHub repo
   │ push
   ▼
GitHub Actions ── lint / typecheck / test / build   ← CI 品質關卡
   │ 通過才繼續
   ▼
wrangler deploy ──► Cloudflare Workers (API)  +  Pages (前端:履歷 + 儀表板)
                          │
              ┌───────────┼─────────────┐
              ▼           ▼             ▼
          D1(短網址)  Analytics      Cron Worker (watchdog)
                       Engine(點擊)   │ 定時檢查錯誤率/延遲
                                       ▼ 異常 → Telegram 告警
```

## 組件(各自單一職責)

| 組件 | 職責 | 技術 | 對外介面 |
|---|---|---|---|
| **site** | 履歷頁 + 公開狀態儀表板頁 | Astro(靜態)on Cloudflare Pages | HTTP(瀏覽器) |
| **api** | 建短網址、302 轉址、寫點擊事件、出 stats JSON | Cloudflare Workers + TypeScript | `POST /api/links`、`GET /:slug`、`GET /api/stats` |
| **db** | 存 slug → 原始 URL、建立時間 | D1 (SQLite) | SQL(僅 api 存取) |
| **metrics** | 記錄每次點擊(slug、時間、來源、延遲) | Analytics Engine | 寫入 binding(僅 api);讀取走 SQL API |
| **watchdog** | 定時查指標,超標發告警 | Cron Trigger Worker → Telegram Bot API | 無對外;cron 觸發 |
| **ci** | lint / typecheck / test / build / deploy | GitHub Actions + Wrangler | git push 觸發 |

### 設計原則:隔離與清晰

- `api` 不直接碰前端,只回 JSON;`site` 不碰 D1,只打 `api`。
- `watchdog` 與 `api` 是不同 Worker,職責分離(請求處理 vs 排程檢查)。
- 每個 Worker binding(D1、Analytics Engine、secrets)在 `wrangler.toml` 明確宣告。

## 資料流

1. **轉址**:訪客開 `short.xxx/abc` → `api` 查 D1 取得原網址 → 寫一筆點擊事件到 Analytics Engine → 回 302 導向。查不到 → 404。
2. **建立**:`POST /api/links {url}` → 產生 slug → 寫 D1 → 回 `{slug, shortUrl}`。
3. **統計**:儀表板頁打 `GET /api/stats` → `api` 用 SQL API 查 Analytics Engine 聚合(總點擊、近 24h、Top slug、p50/p95 延遲)→ 回 JSON → 前端畫圖。
4. **告警**:`watchdog` 每 5–15 分查近期錯誤率與延遲,超過門檻 → 打 Telegram bot → 通知 Derek。

## 錯誤處理

- `GET /:slug` 查無 → 404 頁;D1 錯誤 → 500 + 記 log。
- `POST /api/links` URL 格式不合法 → 400。
- Analytics Engine 寫入失敗**不可**阻擋轉址(轉址優先,埋點盡力而為)。
- `watchdog` 自身失敗也要能被發現(例如連續無心跳 → 另一條告警,後續版本)。

## 測試策略

- **單元**:slug 產生、URL 驗證、stats 聚合查詢的 SQL 組裝。
- **整合**:用 `wrangler dev` / Miniflare 對 `api` 跑 D1 與路由的端到端測試。
- **CI 關卡**:lint(eslint)+ typecheck(tsc)+ test(vitest)必須綠燈才 deploy。

## CI/CD 細節(混合策略)

- **CI(GitHub Actions)**:push / PR → checkout → install → lint → typecheck → test → build。PR 上看得到狀態。
- **CD(同一條 Actions workflow)**:`main` 分支 CI 通過後 → `wrangler deploy`(用 `CLOUDFLARE_API_TOKEN` secret)。
- 部署走 Actions 而非 Cloudflare 原生 Git,理由:pipeline 全程可見、可放 badge、好對外展示「我會寫 CI」。

## 監控細節

- **Cloudflare Web Analytics**:站台流量(免費、隱私友善)。
- **Workers 內建 observability / logs**:請求層級可觀測。
- **Analytics Engine**:自訂點擊事件指標,餵自製儀表板。
- **自製 status 儀表板頁**(在 site):即時顯示總點擊、近 24h、Top 連結、延遲分位。
- **Telegram 告警**:`watchdog` cron Worker,重用 Derek 既有 bot。
- (後續可加)Sentry 做錯誤追蹤,成本低。

## 需先準備

1. Cloudflare 帳號(免費方案足夠)
2. 網域(履歷站建議自訂網域;Cloudflare Registrar 約 US$10/年,或先用免費 `*.pages.dev`)— **待 Derek 決定**
3. GitHub 帳號/repo(已有,帳號 smallkill)
4. 本機(WSL)Node + Wrangler CLI — 已確認 Node v24.16、Wrangler 4.98 可用
5. Telegram bot token(已有,重用)

## 待決定事項

- 專案/服務正式名稱(暫名 `devbox`)
- 是否現在買自訂網域,還是先用 `*.pages.dev` 上線後再接
