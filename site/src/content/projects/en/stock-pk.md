---
title: "US & TW Stock PK: multi-stock return comparison"
role: Personal project · Full-stack + Cloudflare
period: "2026"
tech: [Cloudflare Workers, Pages, D1, Astro, TypeScript, Yahoo Finance API]
cover: /projects/stock-pk/cover.webp
gallery:
  - { src: /projects/stock-pk/screenshot.jpg, caption: "The live tool: TSMC vs 0050 three-year total return, winner highlight and dual-axis growth chart" }
category: personal
links:
  - { label: "Live · TW", href: "https://derek-stock-pk.pages.dev" }
  - { label: "Live · US", href: "https://derek-stock-pk-us.pages.dev" }
  - { label: GitHub, href: "https://github.com/smallkill/stock-pk" }
featured: true
order: 2
---

A minimal "Taiwan multi-stock PK" tool: pick **2–5 stocks**, a date range and an amount, and instantly see each stock's **total return (dividends included)**, final value, and the gap versus a baseline (0050 by default). The winner is highlighted, plotted as a **dual-axis growth chart** (money on the left, return % on the right, hover for any day's value and %).

Independently deployed on the full **Cloudflare** stack:

- **Pages** (Astro): all computation and a hand-rolled SVG growth chart on the client (no charting dependency)
- **Worker**: proxies the Yahoo Finance chart API (avoids CORS + edge caching), returning dividend/split-adjusted series
- **D1**: visitor counter (hashed IP, raw IP never stored)
- Stock list generated at build time from public data (code + Chinese-name autocomplete, TWSE & TPEx)

Engineering details: **corrects splits Yahoo left unadjusted** (Taiwan's ±10% daily limit makes an anomalous same-day ratio unambiguously a split → the artificial discontinuity is smoothed away, e.g. 0052's ~7:1 split in 2025-11), **fair comparison** over the common trading window across all picks, **URL-based sharing** (comparison state encoded in the URL, and shortened on demand via my other project (**devbox's URL shortener**), wired together with a Cloudflare Service Binding, so the short links even show up in devbox's click analytics), and **security** (the proxy guards against SSRF and abuse; the token lives only in a Worker secret).
