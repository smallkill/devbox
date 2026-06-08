# 履歷 RAG ingest

把履歷內容切 chunk、用 Workers AI 算 embedding,輸出 NDJSON 供
`wrangler vectorize upsert` 寫進 Vectorize index `resume`(1024 維,模型 `@cf/baai/bge-m3`)。

## 內容來源(都在 repo 內)

- `site/src/content/experience/{zh,en}/*.md` — 4 份經歷(每語言)
- `site/src/content/projects/{zh,en}/*.md` — 6 個專案(每語言)
- `ask/seed/about.{zh,en}.md` — 自我介紹 / 人格特質 / 技能(由 `site/src/lib/resume.ts`
  的 `intro` / `traits` / `skills` 整理成 markdown;**resume.ts 內容變動時要同步更新這兩檔**)

每檔的 frontmatter(`title` / `org` / `role` / `period`)會串成一行併入可檢索文字,
再依空行段落 + 句末標點切成 ≤ ~600 字的 chunk。

每筆 chunk 的 metadata:`source`(檔案 slug,去前綴數字;seed 檔為 `about`)、
`lang`(zh/en)、`title`、`type`(`experience` / `project` / `about`)、`text`(原文,供 worker 回填)。

## 放 token

Embedding 要呼叫 Cloudflare Workers AI REST API,需要一個有 Workers AI 權限的 API token。
把 token(整檔就是 bearer 字串,別加引號 / 換行)放在:

```
~/.cf_ingest_token
```

帳號 ID 從環境變數讀(不寫死進 repo),實跑前先設定:

```
export CF_ACCOUNT_ID=<你的 Cloudflare account id>
```

(dry-run 不需要;沒設而要實跑會明確報錯。)

> Vectorize 的「寫入」不在本腳本範圍 —— 用 `wrangler vectorize upsert`(走 wrangler OAuth)。

## 跑 ingest

```bash
node ask/scripts/ingest.mjs
```

- **有 token**(`~/.cf_ingest_token` 存在):呼叫 Workers AI(每批 ≤ 50 條),
  輸出 `ask/.cache/vectors.ndjson`,並印出下一步指令。
- **無 token**:走 **dry-run** —— 不打 API,只把切好的 chunks 寫到
  `ask/.cache/chunks.preview.json` 並印統計(幾檔、幾 chunk、各 source 幾條)。
  方便先檢查切分結果。

## 寫進 Vectorize

ingest 實跑產生 `vectors.ndjson` 後:

```bash
cd ask && npx wrangler vectorize upsert resume --file .cache/vectors.ndjson
```

(此步用你自己的 wrangler OAuth 登入跑。)

## 何時重新 ingest

履歷內容變動時就要重跑,並重新 `vectorize upsert`(**務必用 `upsert` 不要用 `insert`**——
`insert` 對已存在的 id 會直接跳過、不覆蓋,改了內容卻沿用同 id 時舊向量不會更新):

- 改了任何 `experience/` 或 `projects/` 的 md
- 改了 `resume.ts` 的 intro / traits / skills(記得同步 `ask/seed/about.*.md`)
- 新增 / 刪除經歷或專案

> `ask/.cache/`(向量、預覽)與 `~/.cf_ingest_token` 都在 `.gitignore`,不會進 git。

## 測試

純函式(`chunkText`、`buildRecords` 等)有單元測試:

```bash
cd ask && npx vitest run
```
