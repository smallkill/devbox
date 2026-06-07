---
title: devbox — self-hosted URL-shortener SaaS
role: Personal project · Full-stack + DevOps
period: "2026"
tech: [Cloudflare Workers, D1, Analytics Engine, GitHub Actions, Astro, TypeScript]
cover: /projects/devbox/cover.png
gallery:
  - { src: /projects/devbox/status.png, caption: Live monitoring dashboard }
links:
  - { label: Live, href: "https://derek-chen.pages.dev/status" }
  - { label: GitHub, href: "https://github.com/smallkill/devbox" }
featured: true
order: 1
---

A URL-shortener SaaS wired end to end — from `git push` through CI/CD to automated deployment and live monitoring.

Built entirely on Cloudflare: Workers handle creation and redirects, D1 stores the links, and Analytics Engine records clicks. A Cron Worker periodically checks health and alerts via Telegram; GitHub Actions runs lint / typecheck / test on every push and only auto-deploys with `wrangler deploy` when everything is green. The frontend ships a real-time click-monitoring dashboard.

It demonstrates self-hosted SaaS + DevOps + Observability end to end, with reliability touches like bearer auth, least-privilege tokens, graceful degradation, and XSS protection.
