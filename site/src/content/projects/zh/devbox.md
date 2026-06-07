---
title: devbox — 自架短網址 SaaS
role: 個人專案 · 全端 + DevOps
period: "2026"
tech:
  ["Cloudflare Workers", "D1", "Analytics Engine", "GitHub Actions", "Astro", "TypeScript"]
cover: /projects/devbox/cover.png
gallery:
  - { src: /projects/devbox/status.png, caption: 即時監控儀表板 }
links:
  - { label: Live, href: "https://derek-chen.pages.dev/status" }
  - { label: GitHub, href: "https://github.com/smallkill/devbox" }
featured: true
order: 1
---

從 `git push` 到 CI/CD 自動部署到即時監控,全棧打通的短網址 SaaS。以 **Cloudflare 全家桶**實作:

- **Workers**(API)— 建立短網址與 302 轉址
- **D1** — 短網址資料儲存
- **Analytics Engine** — 記錄每次點擊事件
- **Cron Worker** — 定時健康檢查,異常透過 Telegram 告警
- **Pages**(Astro)— 即時點擊監控儀表板
- **GitHub Actions** — `git push` 後跑 lint / typecheck / test,全綠才自動 `wrangler deploy`

展示「自架 SaaS + DevOps + Observability」一條龍能力,並落實可靠性與安全設計:

- **bearer 鑑權** — 建立短網址需授權,刻意不對公眾開放以防濫用(open-redirect / 釣魚跳板)
- **最小權限 token** — 查統計用的 token 僅 Analytics Read,與部署 token 分離
- **優雅降級** — 統計端點查詢逾時自動降級,不拖垮頁面
- **XSS 防護** — 儀表板以 DOM API 渲染,不用 innerHTML
