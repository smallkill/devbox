# 真實訪客儀表板(Visitor Dashboard)設計文件

> 日期:2026-06-08 ・ 作者:Derek Chen(NOVA 協助) ・ 狀態:已核可,待轉實作計劃

## 目標

在 devbox 作品集站的 `/status` 觀測台加「訪客」區塊,顯示**真實**的:

- **累計頁面瀏覽數**(all-time page views)
- **今日不重複訪客**(unique visitors today)
- **來訪國家 Top**(國旗 emoji + 次數 + bar,前 6 名)

全用 Cloudflare 既有棧實作(D1 + `request.cf` 地理),強化網站「自架 SaaS + 可觀測性」的故事。近零成本。

## 設計決策(已確認)

- **儲存:D1**(非 Analytics Engine)。理由:數字要**精確、真正累計(永久保存)、SQL 可預測、無抽樣**;D1 已是 api Worker 既有 binding。AE 續用於既有點擊統計,不混入。
- **地理來源:`request.cf.country`**(Cloudflare 邊緣免費提供,ISO 3166-1 alpha-2)。
- **不重複訪客:IP 雜湊**,`sha256(cf-connecting-ip + VISIT_SALT + day)`。含每日 salt → 不可逆、跨日不同(無法追蹤個人)。**絕不存原始 IP**。
- **埋點:client-side beacon**。靜態站每頁載入時 fire-and-forget 打 `/api/visit`;只計真實人類頁面瀏覽(無 JS 的爬蟲不計),符合「真實訪客」語意。
- **顯示位置:`/status`**(觀測台),沿用既有「SQL 主控台」視覺風格。雙語。
- **隱私:只顯示彙整數字**,不公開任何個別訪客 IP 或紀錄。

## 架構

```
訪客載入任一頁(site/Pages)
   │ Base.astro beacon:fetch GET /api/visit?path=…(不 await、失敗無感)
   ▼
api Worker  GET /api/visit
   │ ip_hash = sha256(cf-connecting-ip + VISIT_SALT + day)
   │ country = request.cf.country
   │ INSERT INTO visits(ts, day, ip_hash, country, path)   ← try/catch,一律回 204
   ▼
D1 `visits` 表

儀表板(/status)
   │ GET /api/stats(既有端點,擴充)
   ▼
回 { links, clicks24h, topLinks, visitors:{ views, uniqueToday, topCountries } }
   ▼
Status.astro 渲染「訪客」區塊
```

## 元件(各自單一職責)

| 元件 | 職責 | 依賴 |
|---|---|---|
| **api `GET /api/visit`** | 收 beacon → 算 ip_hash + 取 country → 寫一列 D1 → 回 204 | D1 `DB`、`VISIT_SALT` secret、`request.cf` |
| **api/src/visits.ts** | `hashIp(ip, salt, day)`、`recordVisit(env, req)`、`fetchVisitStats(env)`、`countryFlag(cc)`、`utcDay(ts)`(純函式為主,可單元測試) | D1(僅 recordVisit/fetchVisitStats) |
| **api `GET /api/stats`(擴充)** | 既有回應加 `visitors` 區塊 | visits.ts |
| **site Base.astro beacon** | 每頁載入 fire-and-forget 打 `/api/visit?path=` | 無 |
| **site Status.astro(擴充)** | 渲染總瀏覽 / 今日不重複 / 國家 Top | `/api/stats` |
| **ui.ts** | 訪客區塊雙語字串(`vs_*`) | — |
| **api/schema.sql** | `visits` 表 + index | — |

## 資料模型(D1)

```sql
CREATE TABLE IF NOT EXISTS visits (
  ts       INTEGER NOT NULL,   -- Date.now()
  day      TEXT    NOT NULL,   -- 'YYYY-MM-DD'(UTC)
  ip_hash  TEXT    NOT NULL,   -- sha256(ip + salt + day),不可逆
  country  TEXT,               -- ISO alpha-2,可能為空
  path     TEXT
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);
```

查詢:
- 累計瀏覽:`SELECT count(*) AS n FROM visits`
- 今日不重複:`SELECT count(DISTINCT ip_hash) AS n FROM visits WHERE day = ?`(今天 UTC)
- 國家 Top:`SELECT country, count(*) AS n FROM visits WHERE country IS NOT NULL AND country != '' GROUP BY country ORDER BY n DESC LIMIT 6`

## 資料流細節

1. **埋點**:`Base.astro` 內 inline script,頁面載入後 `fetch(API_URL + "/api/visit?path=" + encodeURIComponent(location.pathname), {mode:"no-cors", keepalive:true})`,不 await、`catch(()=>{})`。每次頁面載入一筆。
2. **`GET /api/visit`**:
   - `ip = req.headers.get("cf-connecting-ip") ?? "0.0.0.0"`
   - `country = (req.cf?.country as string) ?? ""`(本機 dev 無 cf 物件 → 空)
   - `day = utcDay(Date.now())`、`ip_hash = await hashIp(ip, env.VISIT_SALT, day)`
   - `INSERT INTO visits ...`,整段 try/catch,**一律回 `204`**(beacon 不需內容),帶 CORS `*`。
   - `path` 取 query `?path=`,長度上限 256、只留字串(防濫用)。
3. **`GET /api/stats`**:呼叫 `fetchVisitStats(env)`,把 `visitors` 併入回應;查詢失敗 → `visitors: null`(前端降級)。
4. **`/status` 渲染**:Status.astro 既有 fetch /api/stats 的 client script 擴充,讀 `visitors` 渲染三塊;`countryFlag` 把 alpha-2 轉國旗 emoji(regional indicator);無資料顯示「尚無訪客」。

## 隱私

- 只存 `ip_hash`(`sha256(ip + VISIT_SALT + day)`);salt 為 Worker secret,雜湊含日期 → 跨日不可關聯、不可逆。
- 不存、不回傳、不顯示原始 IP。國家為粗粒度彙整。
- `/api/stats` 的 `visitors` 只含彙整數字與國家計數,無任何個別紀錄。

## 錯誤處理 / 降級

- beacon:fire-and-forget,任何失敗(離線、worker 掛)使用者無感、不阻擋頁面。
- `/api/visit`:D1 寫入包 try/catch,失敗仍回 204(寧可漏記一筆,不可報錯)。
- `/api/stats`:`fetchVisitStats` 失敗回 `null`,前端 visitors 區塊顯示「—」或「尚無資料」,不拖垮既有點擊指標。
- 本機 dev:無 `request.cf` → country 空字串,流程仍可跑。

## 測試策略

- **單元(vitest)**:
  - `utcDay(ts)` → 'YYYY-MM-DD'
  - `hashIp(ip, salt, day)` → 決定性、同輸入同輸出、不同 ip/day 不同雜湊、輸出為 hex、不含原始 ip
  - `countryFlag('TW')` → 🇹🇼;非法/空 → 安全回退(地球或空)
  - `fetchVisitStats` 結果映射(給定 D1 回傳列 → 正確 `{views, uniqueToday, topCountries}`)
- **整合(@cloudflare/vitest-pool-workers,miniflare D1)**:
  - `GET /api/visit` 寫入一列、回 204;連打兩次同 ip → views=2、uniqueToday=1
  - `GET /api/stats` 回應含 `visitors` 區塊且數字正確
  - D1 查詢失敗路徑 → `visitors: null`(可用未建表或 mock 模擬)
- **人工驗收**:部署後實際瀏覽幾頁,確認 /status 數字增加、國家正確顯示。

## 部署 / Migration

- `api/schema.sql` 追加 `visits` 表;部署前對遠端 D1 跑:
  `cd api && npx wrangler d1 execute devbox --remote --file schema.sql`(`CREATE TABLE IF NOT EXISTS` 冪等,不影響既有 links 表)。
- 新 secret:`cd api && npx wrangler secret put VISIT_SALT`(隨機字串)。
- CI 既有 deploy job 會部署 api;VISIT_SALT 為 secret 不進 git。

## 非目標(YAGNI)

「現在 N 人在線」(需 Durable Object)、跨日/全站不重複訪客、熱門頁面、訪客地圖視覺化、bot 過濾、referrer 來源分析。先做 B 檔三指標,日後要再加。

## 待實作時定

- 國家 Top 顯示數量(暫定 6)。
- beacon 是否去重(同人同頁同日多次載入都計為瀏覽)— 暫定**全計**(符合「page views」語意);若被洗量再加 `(ip_hash, path, day)` 去重。
