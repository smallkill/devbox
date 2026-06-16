---
title: "Resume RAG: Ask my resume"
role: Personal project · AI / RAG + Full-stack
period: "2026"
tech: [Cloudflare Workers AI, Vectorize, bge-m3, Llama 3.3, RAG, Astro]
cover: /projects/resume-rag/cover.webp
links:
  - { label: Live, href: "https://derek-chen.pages.dev/ask" }
  - { label: GitHub, href: "https://github.com/smallkill/devbox" }
featured: true
order: 0
category: personal
---

An `/ask` page on the resume site that lets visitors query my experience, projects, and skills in natural language. The whole **RAG pipeline runs on Cloudflare**, and is itself a demonstration of building LLM / RAG applications:

- **Workers AI · bge-m3**: multilingual embeddings (1024-dim) for the question and resume content
- **Vectorize**: vector search that retrieves the most relevant resume chunks (top-k)
- **Workers AI · Llama 3.3**: streams an answer grounded in the retrieved chunks
- **Astro Pages**: bilingual chat UI with token-by-token streaming and cited sources
- **Deploy-time ingest**: resume content is chunked → embedded → upserted into Vectorize

The focus is **trustworthiness** and **cost control**: the safeguards a public, unauthenticated endpoint needs:

- **Anti-hallucination grounding**: answers only from retrieved chunks; says "not in my resume" when it can't find something instead of guessing; declines sensitive questions (salary / personal data)
- **Prompt-injection defense**: the user's question is wrapped in `<question>` fences so it can't override the rules
- **Cost guardrails**: a global daily cap plus per-IP rate limiting, so it can't be abused as a free LLM proxy
- **Graceful degradation**: AI / vector failures return a friendly error rather than a bare 500
