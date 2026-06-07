# 履歷 RAG 問答(「Ask my resume」)設計文件

> 日期:2026-06-07 ・ 作者:Derek Chen(NOVA 協助) ・ 狀態:已核可,待轉實作計劃

## 目標

在作品集網站加一個 `/ask` 頁,讓訪客用自然語言查詢 Derek 的履歷(經歷、專案、技能、背景動機)。
全用 Cloudflare 技術棧實作(零/極低成本),本身即是「會做 RAG / LLM 應用」的作品展示,
補足 AI/DevOps 定位,與 devbox 的 Cloudflare 故事一脈相承。

## 設計決策(已確認)

- **LLM**:Cloudflare **Workers AI**(開源模型,如 Llama 3.x)+ **bge** embeddings。免費額度足以支撐履歷問答流量。
- **介面**:專用 `/ask` 頁(chat UI),非浮動泡泡、非首頁嵌入。
- **知識範圍**:履歷結構化內容(經歷/專案/技能/intro)+ 自傳背景。**只以這些為根據回答。**
- **獨立 Worker**:RAG 不混進短網址 `api` worker,獨立部署(各自單一職責、各自是 showcase)。
- **雙語**:依問題語言回答。
- **串流回答**:逐字顯示(Workers AI 支援 streaming)。

## 架構

```
/ask 頁(chat UI,site/Astro)
   │ POST { question }
   ▼
ask Worker (Cloudflare Workers)
   │ ① guardrail:長度檢查、rate limit、injection 過濾
   │ ② embed 問題(Workers AI · @cf/baai/bge-*)
   │ ③ Vectorize 查 top-k 相關 chunks
   │ ④ 組 context + grounding system prompt
   │ ⑤ Workers AI LLM 生成(streaming)
   ▼
SSE/串流回答 + 引用來源(slug → 連到對應履歷區/專案頁)

[部署時] ingest 腳本:讀履歷內容+自傳 → 切 chunk → embed → upsert Vectorize
```

## 元件(各自單一職責)

| 元件 | 職責 | 依賴 |
|---|---|---|
| **ask/**(新 Worker) | `POST /api/ask`:guardrail → embed → retrieve → generate(stream);回傳答案 + 來源 | Workers AI binding `AI`、Vectorize binding `VECTORIZE` |
| **ask/src/rag.ts** | 純函式:chunk 切分、prompt 組裝、來源去重(可單元測試) | — |
| **ask/scripts/ingest.ts** | 部署時:讀履歷內容(site content collections + 自傳)→ chunk → embed → upsert Vectorize | Workers AI / Vectorize(經 wrangler 或 REST) |
| **Vectorize index** `resume` | 存履歷 chunks 的向量 + metadata(來源 slug、語言、類型) | — |
| **site/src/pages/ask.astro**(+ `/en/ask`) | chat UI:輸入框、範例問題、串流顯示、引用來源、loading/error 狀態 | 呼叫 ask Worker |
| **nav**(Base.astro) | 加「問我任何事 / Ask」連結(雙語) | — |

## 資料流

1. **Ingest(部署時)**:`ingest.ts` 讀履歷母體(experience/projects md 的 frontmatter+body、resume.ts 的 intro/skills/traits、自傳),切成語義 chunks(每 chunk 帶 metadata:`source`、`lang`、`type`),用 Workers AI embed,upsert 進 Vectorize `resume` index。中英內容分別 ingest(metadata 標 lang)。
2. **Query(訪客提問)**:`/api/ask` 收到 `{ question }` →
   a. guardrail:長度 ≤ 500 字、rate limit、擋空/injection。
   b. embed 問題向量 → Vectorize query top-k(依問題語言過濾 metadata,k≈5)。
   c. 組 context(檢索片段 + 來源標記)+ grounding system prompt(見下)。
   d. Workers AI LLM streaming 生成 → SSE 回前端逐字顯示。
   e. 回傳檢索到的來源清單(slug + 標題)供前端顯示「引用自」。

## Grounding / 防幻覺

System prompt 要點:
- 「你是 Derek Chen 履歷的問答助理。**只能根據以下提供的履歷片段回答**。」
- 「若片段中找不到答案,直接說『我的履歷裡沒有這個資訊』,**不要臆測或編造**。」
- 「以提問的語言回答(中文問→中文答,English→English)。」
- 「拒答薪資、個資、聯絡電話等敏感問題,引導對方直接看履歷或來信。」
- 回答後附**引用來源**(對應的經歷/專案 slug),前端連到該頁。

## 成本與防濫用(關鍵)

- **Workers AI 免費額度**(每日 neurons 配額)為主;履歷問答流量極低,實務近零成本。
- **AI Gateway**:① 相同問題**快取**(直接回不耗額度)② **rate limit**(每 IP 每分鐘上限)③ 用量/成本分析儀表板。
- **硬上限**:Worker 內計數(KV 或 Durable Object 簡易計數);超過每日全站上限 → 回「今日問答已達上限,請稍後再試或直接看履歷」,**絕不無上限往下打**。
- 問題長度上限、空輸入擋掉、明顯 injection pattern 過濾。

## 錯誤處理 / 降級

- Workers AI 或 Vectorize 失敗 → 回友善錯誤訊息(「AI 暫時無法回應,請直接瀏覽履歷」)+ 連回首頁,不裸露錯誤。
- 檢索 0 命中 → grounding prompt 已涵蓋(回「沒有這個資訊」)。
- 前端:loading 狀態、串流中斷重試、空回應處理。

## 測試策略

- **單元**(vitest):`rag.ts` 的 chunk 切分、prompt 組裝、來源去重、guardrail(長度/injection 判斷)。
- **整合**:Workers AI / Vectorize 在測試環境難 mock → 以 `@cloudflare/vitest-pool-workers` 對 guardrail 與路由做端到端;LLM/embedding 呼叫做成可注入的介面以便測試降級分支。
- **人工驗收**:部署後實測幾個代表問題(中英)、離題問題(應婉拒)、超量(應擋)。

## 非目標(YAGNI)

多輪對話記憶、登入、付費、回答評分/feedback、上傳新文件即時 re-index(ingest 走部署流程即可)。

## 待實作時定

- 確切 Workers AI 模型:embedding **需多語**(中英)→ 傾向 `@cf/baai/bge-m3`;LLM 也需中文能力 → 候選 Llama 3.3 instruct 或 Qwen 系(Workers AI 有),實作時比較中文回答品質後選定。
- rate limit 數值、每日上限數值 — 先保守設定,觀察後調整。
- ingest 是手動跑(`npm run ingest`)還是接進 CI — 先手動,內容變動時重跑。
