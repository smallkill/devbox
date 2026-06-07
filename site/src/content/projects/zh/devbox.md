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

從 `git push` 到 CI/CD 自動部署到即時監控,全棧打通的短網址 SaaS。

以 Cloudflare 全家桶實作:Workers 處理建立與轉址、D1 儲存、Analytics Engine 記錄點擊;
Cron Worker 定時檢查並透過 Telegram 告警;GitHub Actions 在 `git push` 後跑 lint / typecheck / test,
全綠才自動 `wrangler deploy`。前端附即時點擊監控儀表板。

展示「自架 SaaS + DevOps + Observability」一條龍能力,並落實 bearer 鑑權、最小權限 token、
優雅降級與 XSS 防護等可靠性設計。
