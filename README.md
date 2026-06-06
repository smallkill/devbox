# devbox

> **Derek Chen** · Software / DevOps Engineer · [derek-chen.pages.dev](https://derek-chen.pages.dev)

自架短網址 SaaS — 從 `git push` 經 CI/CD 自動部署到 Cloudflare,附即時監控儀表板、Telegram 告警與履歷頁。展示「自架 SaaS + DevOps + Observability」一條龍能力。

**🟢 Live**
- 履歷 + 儀表板:https://derek-chen.pages.dev(`/status` 為即時監控)
- API:https://devbox-api.chinte-cheng.workers.dev

## 架構

```
 git push (main)
      │
      ▼
 GitHub Actions ── lint · typecheck · test ──► wrangler deploy
      │ 全綠才部署                                    │
      ▼                                              ▼
   品質關卡                          Workers(api · watchdog) + Pages(site)
                                                     │
                            ┌────────────────────────┼─────────────────────┐
                            ▼                        ▼                      ▼
                       D1(短網址)          Analytics Engine(點擊)     Cron Worker
                                                                     每15分 → Telegram 告警
```

| 單元 | 職責 | 技術 |
|---|---|---|
| `api/` | 建短網址、302 轉址、出真實統計 | Cloudflare Workers + D1 + Analytics Engine |
| `watchdog/` | 定時查指標、異常告警 | Cron Trigger Worker → Telegram |
| `site/` | 履歷 + 公開狀態儀表板(clicks24h、Top 連結) | Astro(靜態)on Pages |
| `.github/workflows/ci.yml` | lint / typecheck / test → 自動 deploy | GitHub Actions + Wrangler |

## API

| 方法 | 路徑 | 說明 |
|---|---|---|
| `POST` | `/api/links` | 建短網址。需 `Authorization: Bearer <CREATE_TOKEN>`。body:`{"url":"https://…"}` |
| `GET` | `/:slug` | 302 轉址,並寫一筆點擊事件到 Analytics Engine |
| `GET` | `/api/stats` | 回 `{links, clicks24h, topLinks}`(public 唯讀,CORS 開放) |

建一個短網址:

```bash
curl -X POST https://devbox-api.chinte-cheng.workers.dev/api/links \
  -H "authorization: Bearer $CREATE_TOKEN" \
  -H "content-type: application/json" \
  -d '{"url":"https://example.com"}'
# → {"slug":"Ab12Cd","shortUrl":"https://devbox-api.chinte-cheng.workers.dev/Ab12Cd"}
```

## 本機開發

```bash
npm install          # 安裝 api + watchdog 依賴
npm run lint         # ESLint
npm run typecheck    # tsc
npm test             # Vitest(@cloudflare/vitest-pool-workers,跑在 Workers runtime)
cd site && npm install && npm run dev   # 前端
```

## 從零部署(可複現)

需要 Cloudflare 帳號與 GitHub repo。

1. **登入**:`npx wrangler login`(WSL 若 OAuth callback 失敗,改用 `CLOUDFLARE_API_TOKEN` 環境變數)
2. **建 D1**:`cd api && npx wrangler d1 create devbox` → 把 `database_id` 填進 `api/wrangler.toml`
3. **套 schema**:`npx wrangler d1 execute devbox --remote --file schema.sql`
4. **啟用 Analytics Engine**:Dashboard → Workers → Analytics Engine,建 dataset `devbox_clicks`(binding `CLICKS`)
5. **設 Worker secrets**:
   ```bash
   cd api      && npx wrangler secret put CREATE_TOKEN   # 建短網址的 bearer
                  npx wrangler secret put AE_API_TOKEN    # 查 AE 統計(僅需 Account Analytics: Read)
   cd watchdog && npx wrangler secret put TELEGRAM_TOKEN
                  npx wrangler secret put TELEGRAM_CHAT_ID
   ```
   `api/wrangler.toml` 的 `[vars] CF_ACCOUNT_ID` 填你的 account id。
6. **部署 Workers**:`npx wrangler deploy`(在 `api/` 與 `watchdog/` 各跑一次)
7. **GitHub Secret**:repo Settings → Secrets → 新增 `CLOUDFLARE_API_TOKEN`(用 *Edit Cloudflare Workers* 範本)。之後 push 到 `main` 即自動部署。
8. **Pages**:`cd site && PUBLIC_API_URL=<api 網域> npm run build && npx wrangler pages deploy dist --project-name derek-chen --branch main`

## 安全與可靠性設計

- **建立鑑權**:`POST /api/links` 需 bearer token,fail-closed,避免公開 endpoint 被當釣魚跳板(open-redirect 濫用)。
- **輸入限制**:轉址只接受 `http(s)`、長度 ≤ 2048;slug 用 `crypto` + rejection sampling(無模偏差)。
- **最小權限**:`AE_API_TOKEN` 僅 Analytics Read,與部署用的 CI token 分離。
- **優雅降級**:`/api/stats` 查 AE 有 3s timeout,AE 不健康時只回連結數、不拖垮頁面。
- **XSS 防護**:儀表板用 DOM API + `textContent` 渲染,不用 `innerHTML`。
- **SQL**:D1 全參數綁定;AE query 的 dataset 為程式常數,無使用者輸入進 SQL。

## 已知範圍

- `watchdog` 的 `fetchMetrics` 目前回安全值;真實 error rate / p95 告警需在 `api` 把 status/延遲一併寫入 Analytics Engine(後續)。
