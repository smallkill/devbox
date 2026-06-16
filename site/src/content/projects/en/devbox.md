---
title: "devbox: self-hosted URL-shortener SaaS"
role: Personal project · Full-stack + DevOps
period: "2026"
tech: [Cloudflare Workers, D1, Analytics Engine, GitHub Actions, Astro, TypeScript]
cover: /projects/devbox/cover.webp
gallery:
  - { src: /projects/devbox/status.png, caption: Live monitoring dashboard }
links:
  - { label: Live, href: "https://derek-chen.pages.dev/status" }
  - { label: GitHub, href: "https://github.com/smallkill/devbox" }
featured: true
order: 1
category: personal
---

A URL-shortener SaaS wired end to end, from `git push` through CI/CD to automated deployment and live monitoring. Built entirely on the **Cloudflare stack**:

- **Workers** (API): link creation and 302 redirects
- **D1**: link storage
- **Analytics Engine**: records every click event
- **Cron Worker**: periodic health checks, alerts via Telegram on anomalies
- **Pages** (Astro): real-time click-monitoring dashboard
- **GitHub Actions**: lint / typecheck / test on every push, auto-`wrangler deploy` only when green

It demonstrates self-hosted SaaS + DevOps + Observability end to end, with deliberate reliability and security design:

- **Bearer auth**: link creation requires authorization, intentionally not open to the public to prevent abuse (open-redirect / phishing relay)
- **Least-privilege tokens**: the stats token is Analytics-Read only, separate from the deploy token
- **Graceful degradation**: the stats endpoint degrades on query timeout instead of stalling the page
- **XSS protection**: the dashboard renders via DOM APIs, not innerHTML

This link-shortening API is also consumed by my other project, the **TW Stock PK** tool, wired in through a Cloudflare **Service Binding** to shorten its share links, so those clicks flow back into this site's analytics and the two services share one dataset.
