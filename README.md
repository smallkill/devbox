# devbox

自架短網址 SaaS — 從 `git push` 經 CI/CD 自動部署到 Cloudflare,附即時監控儀表板、Telegram 告警與履歷頁。展示「自架 SaaS + DevOps + Observability」。

## 架構

| 單元 | 職責 | 技術 |
|---|---|---|
| `api/` | 建短網址、302 轉址、出 stats | Cloudflare Workers + D1 + Analytics Engine |
| `watchdog/` | 定時查指標、異常告警 | Cron Trigger Worker → Telegram |
| `site/` | 履歷 + 公開狀態儀表板 | Astro(靜態)on Pages |
| `.github/workflows/ci.yml` | lint / typecheck / test → deploy | GitHub Actions + Wrangler |

## 本機開發

```bash
npm install          # 安裝 api + watchdog 依賴
npm run lint         # ESLint
npm run typecheck    # tsc
npm test             # Vitest(Workers runtime)
cd site && npm install && npm run dev   # 前端
```

## 部署前置(Phase 6 — 需 Cloudflare 帳號)

> ⚠️ 在完成以下步驟前,`api/wrangler.toml` 的 `database_id` 仍是 placeholder,
> push 到 `main` 的 deploy job 會失敗。請先:

1. **登入**:`npx wrangler login`
2. **建 D1**:`cd api && npx wrangler d1 create devbox` → 把回傳的 `database_id` 填進 `api/wrangler.toml`
3. **套 schema**:`npx wrangler d1 execute devbox --remote --file schema.sql`
4. **設 secrets**:
   ```bash
   cd api      && npx wrangler secret put CREATE_TOKEN
   cd watchdog && npx wrangler secret put TELEGRAM_TOKEN
                  npx wrangler secret put TELEGRAM_CHAT_ID
   ```
5. **GitHub Secret**:repo Settings → Secrets → 新增 `CLOUDFLARE_API_TOKEN`(權限:Workers Scripts Edit、D1 Edit)
6. **Pages**:Cloudflare Pages 接此 repo,build 目錄指向 `site/`,設環境變數 `PUBLIC_API_URL` 指向 api Worker 網域
7. **真實指標**:接 Analytics Engine SQL API,讓 `/api/stats` 與 watchdog 回真實點擊/錯誤率(見 `api/src/stats.ts`)

## 安全說明

- 建立短網址(`POST /api/links`)需 `Authorization: Bearer <CREATE_TOKEN>`,fail-closed,避免公開 endpoint 被當釣魚跳板濫用。
- 轉址只接受 `http(s)` 且長度 ≤ 2048。
