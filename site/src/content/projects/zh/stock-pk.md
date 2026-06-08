---
title: 台股多檔 PK — 投報率比較工具
role: 個人專案 · 全端 + Cloudflare
period: "2026"
tech:
  ["Cloudflare Workers", "Pages", "D1", "Astro", "TypeScript", "Yahoo Finance API"]
cover: /projects/stock-pk/cover.jpg
category: personal
links:
  - { label: Live, href: "https://derek-stock-pk.pages.dev" }
  - { label: GitHub, href: "https://github.com/smallkill/stock-pk" }
featured: true
order: 2
---

一個極簡的「台股多檔 PK」小工具:選 **2~5 檔**股票、日期區間、投資金額,一鍵算出每檔的**含息總報酬率**、最終金額、相對基準(預設 0050)的差額,標出贏家,並畫成**雙軸成長曲線圖**(左金額、右報酬%、hover 看任一日的金額與%)。

獨立部署、全 **Cloudflare** 棧:

- **Pages**(Astro)— 純前端計算與 SVG 成長圖(手刻、無第三方圖表依賴)
- **Worker** — 代理 Yahoo Finance chart API(避 CORS + 邊緣快取),回含息還原權值序列
- **D1** — 訪客數(IP 雜湊,不存原始 IP)
- 股票清單 build 時由公開資料產生(代號 + 中文名即時候選,支援上市/上櫃)

落實工程細節:**修正 Yahoo 漏調的拆股**(台股 ±10% 漲跌幅限制使單日異常比值必為拆股 → 自動弭平假斷層,例如 0052 2025-11 的 7:1)、**公平比較**取所有標的的共同交易區間、**網址型分享**(比較狀態編進 URL,並可一鍵透過我另一個專案 **devbox 的短網址服務**縮短——兩個專案以 Cloudflare Service Binding 串接,短連結也會進 devbox 的點擊統計)、**安全**(代理端點防 SSRF 與濫用、token 僅存於 Worker secret)。
