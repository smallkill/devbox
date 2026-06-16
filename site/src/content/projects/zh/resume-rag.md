---
title: "履歷 RAG 問答:Ask my resume"
role: 個人專案 · AI / RAG + 全端
period: "2026"
tech:
  ["Cloudflare Workers AI", "Vectorize", "bge-m3", "Llama 3.3", "RAG", "Astro"]
cover: /projects/resume-rag/cover.webp
links:
  - { label: Live, href: "https://derek-chen.pages.dev/ask" }
  - { label: GitHub, href: "https://github.com/smallkill/devbox" }
featured: true
order: 0
category: personal
---

在履歷站上加一個 `/ask` 頁,讓訪客用自然語言問我的經歷、專案與技能。整條 **RAG pipeline 全用 Cloudflare 實作**,本身就是「會做 LLM / RAG 應用」的作品:

- **Workers AI · bge-m3**:把問題與履歷內容做多語 embedding(1024 維)
- **Vectorize**:向量檢索,取最相關的履歷片段(top-k)
- **Workers AI · Llama 3.3**:依檢索片段串流生成回答
- **Astro Pages**:雙語聊天介面,逐字串流顯示 + 引用來源
- **部署時 ingest**:履歷內容切 chunk → embed → 寫入 Vectorize

重點放在**可信**與**控成本**,這是公開無鑑權端點該有的防護:

- **防幻覺 grounding**:只根據檢索到的履歷片段回答,查不到就說「沒有這個資訊」,不臆測;薪資 / 個資等敏感問題婉拒
- **prompt 注入防護**:使用者問題以 `<question>` 圍欄包裹,不被當成可覆蓋規則的指令
- **成本護欄**:每日全站上限 + per-IP 限流,避免被當免費 LLM proxy
- **優雅降級**:AI / 向量服務失敗回友善錯誤,不裸露 500
