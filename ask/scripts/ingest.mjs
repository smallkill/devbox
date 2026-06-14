// 履歷 RAG ingest:讀 repo 內的履歷 md → 切 chunk → Workers AI 算 embedding
// → 輸出 NDJSON 供 `wrangler vectorize upsert resume` 寫入 Vectorize(1024 維)。
//
// 本檔的純函式(chunkText / buildRecords)不碰 IO/網路,可單元測試。
// 所有檔案系統 / 網路只在 main() 流程裡,且 node builtin 用動態 import,
// 讓 Workers runtime 下的 vitest 也能安全 import 本模組(只取純函式)。

// ── 設定 ──────────────────────────────────────────────────────────────
// Cloudflare account id 從環境變數讀,不寫死進 repo。實跑 embedding 前才需要;
// dry-run(無 token)不會用到。設定方式:export CF_ACCOUNT_ID=<你的 account id>
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? "";
const MODEL = "@cf/baai/bge-m3"; // 1024 維
const BATCH_SIZE = 50;
const CHUNK_MAX = 600;

// ── 純函式:切 chunk(等價 ask/src/rag.ts 的 chunkText)──────────────────
/**
 * 依空行切段落;單段超過 max 再依句末標點(。.!?,含全形)切,貪婪打包至 ~max。
 * 短文回單元素陣列。
 * @param {string} text
 * @param {number} max
 * @returns {string[]}
 */
export function chunkText(text, max = CHUNK_MAX) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const out = [];
  for (const para of paragraphs) {
    if (para.length <= max) {
      out.push(para);
      continue;
    }
    const sentences = splitSentences(para);
    let buf = "";
    for (const sent of sentences) {
      if (buf.length === 0) {
        buf = sent;
      } else if (buf.length + 1 + sent.length <= max) {
        buf = `${buf} ${sent}`;
      } else {
        out.push(buf);
        buf = sent;
      }
    }
    if (buf.length > 0) out.push(buf);
  }

  return out;
}

/** 在句末標點(。.!?,含全形)後切分,保留標點。 */
function splitSentences(text) {
  const parts = [];
  let start = 0;
  const enders = new Set(["。", ".", "!", "?", "！", "？"]);
  for (let i = 0; i < text.length; i++) {
    if (enders.has(text[i])) {
      let end = i + 1;
      while (end < text.length && /\s/.test(text[end])) end++;
      parts.push(text.slice(start, end).trim());
      start = end;
      i = end - 1;
    }
  }
  if (start < text.length) {
    const tail = text.slice(start).trim();
    if (tail.length > 0) parts.push(tail);
  }
  return parts.filter((p) => p.length > 0);
}

// ── 純函式:frontmatter / slug / 檔案 → records ─────────────────────────

/**
 * 最小 frontmatter 解析:抓第一組 `---\n...\n---`。
 * @param {string} raw
 * @returns {{ frontmatter: string, body: string }}
 */
export function splitFrontmatter(raw) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!m) return { frontmatter: "", body: raw.trim() };
  return { frontmatter: m[1], body: raw.slice(m[0].length).trim() };
}

/** 從 frontmatter 用正則抓某欄位(取冒號後整行,去引號)。 */
export function fmField(frontmatter, key) {
  const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, "m");
  const m = re.exec(frontmatter);
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "").trim();
}

/**
 * 抓 frontmatter 的 YAML 清單欄位(如 experience 的 `highlights:`)。
 * 取 `key:` 之後縮排的 `- ` 項目,直到遇到下一個頂層 key。
 * 每項去引號、去 HTML 標籤(highlights 可含 inline `<a>`/`<strong>`),回傳純文字陣列。
 */
export function fmList(frontmatter, key) {
  const re = new RegExp(`^${key}\\s*:\\s*\\n([\\s\\S]*?)(?=^\\S|$(?![\\r\\n]))`, "m");
  const m = re.exec(frontmatter);
  if (!m) return [];
  const items = [];
  for (const line of m[1].split("\n")) {
    const im = /^\s+-\s+(.*)$/.exec(line);
    if (!im) continue;
    const val = im[1]
      .trim()
      .replace(/^["']|["']$/g, "") // 去外層引號
      .replace(/<[^>]+>/g, "") // 去 HTML 標籤,保留可見文字
      .trim();
    if (val) items.push(val);
  }
  return items;
}

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * 把履歷日期區間正規化成 LLM 能完整照抄的明確格式(僅供 RAG 文字,網站顯示不受影響)。
 *   "2023.06 – 2026.04" → zh「2023年6月至2026年4月」/ en「June 2023 to April 2026」
 *   "2026.04 – 現在"     → zh「2026年4月至今」      / en「April 2026 to present」
 * 為什麼:小模型對「YYYY.MM」點格式常把年份吃掉(看成小數),輸出殘缺如「.06 –.04」。
 * 非「YYYY.MM」格式(英文月名、純年份)不符正則 → 原樣返回,不動。
 * @param {string} period
 * @param {"zh"|"en"} lang
 */
export function normalizePeriod(period, lang = "zh") {
  if (!period) return period;
  const parts = period.split(/[–—-]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) return period;
  // 把 "YYYY.MM" 展開成明確年月;非此格式回原值。
  const expand = (p) => {
    const m = /^(\d{4})\.(\d{1,2})$/.exec(p);
    if (!m) return p;
    const mo = parseInt(m[2], 10);
    if (mo < 1 || mo > 12) return p;
    return lang === "en" ? `${MONTHS_EN[mo - 1]} ${m[1]}` : `${m[1]}年${mo}月`;
  };
  const a = expand(parts[0]);
  if (a === parts[0]) return period; // 起點不是 YYYY.MM → 整段原樣(連分隔符都不動)
  if (/現在|至今|present|now/i.test(parts[1])) // 結尾是「至今」類開放式
    return lang === "en" ? `${a} to present` : `${a}至今`;
  const b = expand(parts[1]);
  if (b === parts[1]) return period; // 終點不符(如夾雜文字)→ 原樣,不半套處理
  return lang === "en" ? `${a} to ${b}` : `${a}至${b}`;
}

/**
 * 檔名 → slug:去 .md、去前綴數字(`2-moxa` → `moxa`)。
 * @param {string} filename
 */
export function slugFromFilename(filename) {
  const base = filename.replace(/\.md$/i, "");
  return base.replace(/^\d+-/, "");
}

/**
 * 把一個檔案描述轉成它的「來源元資料 + 可檢索文字」。
 * @param {{ filename: string, lang: "zh"|"en", type: "experience"|"project"|"about", raw: string }} file
 */
export function describeFile(file) {
  const { filename, lang, type, raw } = file;
  const { frontmatter, body } = splitFrontmatter(raw);

  // source:experience/project 用 slug;seed(about)固定 about。
  const source = type === "about" ? "about" : slugFromFilename(filename);

  // title:抓 frontmatter title:,抓不到回退 org:,再回退檔名 slug。
  const title =
    fmField(frontmatter, "title") ||
    fmField(frontmatter, "org") ||
    slugFromFilename(filename);

  // 文字 = title/org/role/period 串一行(讓 metadata 也可被檢索)+ body。
  const metaLineParts = [
    fmField(frontmatter, "title"),
    fmField(frontmatter, "org"),
    fmField(frontmatter, "role"),
    normalizePeriod(fmField(frontmatter, "period"), lang),
  ].filter((s) => s.length > 0);
  const metaLine = metaLineParts.join(" · ");

  // experience 是純 frontmatter(無 body),重點在 highlights 清單 —
  // 抓出來併入文字,RAG 才檢索得到經歷細節(含專利等)。
  // 各 highlight 之間用空行分隔,讓 chunkText 切成獨立 chunk —
  // 每條成就/專利可被精準檢索(整段合一會稀釋特定主題如「專利」的訊號)。
  const highlights = fmList(frontmatter, "highlights");
  const bodyParts = [highlights.join("\n\n"), body].filter((s) => s.length > 0);
  const text = [metaLine, bodyParts.join("\n\n")]
    .filter((s) => s.length > 0)
    .join("\n\n");

  return { source, lang, title, type, text };
}

/**
 * 純函式:輸入檔案內容陣列 → 輸出 records(不含網路/IO)。
 * 每個 chunk 一筆 record;id = `${source}-${lang}-${index}`。
 * @param {Array<{ filename: string, lang: "zh"|"en", type: "experience"|"project"|"about", raw: string }>} files
 * @returns {Array<{ id: string, text: string, metadata: { source: string, lang: string, title: string, type: string, text: string } }>}
 */
export function buildRecords(files) {
  const records = [];
  for (const file of files) {
    const { source, lang, title, type, text } = describeFile(file);
    const chunks = chunkText(text, CHUNK_MAX);
    chunks.forEach((chunk, index) => {
      records.push({
        id: `${source}-${lang}-${index}`,
        text: chunk,
        metadata: { source, lang, title, type, text: chunk },
      });
    });
  }
  return records;
}

// ── IO / 網路(只在 main 流程)─────────────────────────────────────────

/** 蒐集 repo 內所有要 ingest 的 md 檔(回傳 buildRecords 吃的形狀)。 */
async function collectFiles() {
  const { readFile, readdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const here = path.dirname(fileURLToPath(import.meta.url)); // ask/scripts
  const askDir = path.resolve(here, "..");
  const repoRoot = path.resolve(askDir, "..");
  const siteContent = path.join(repoRoot, "site", "src", "content");

  const files = [];

  // experience / project:zh + en
  const dirs = [
    { type: "experience", rel: path.join("experience") },
    { type: "project", rel: path.join("projects") },
  ];
  for (const { type, rel } of dirs) {
    for (const lang of ["zh", "en"]) {
      const dir = path.join(siteContent, rel, lang);
      let entries;
      try {
        entries = await readdir(dir);
      } catch {
        continue;
      }
      for (const filename of entries.filter((f) => f.endsWith(".md")).sort()) {
        const raw = await readFile(path.join(dir, filename), "utf8");
        files.push({ filename, lang, type, raw });
      }
    }
  }

  // seed:about.zh.md / about.en.md
  const seedDir = path.join(askDir, "seed");
  for (const lang of ["zh", "en"]) {
    const filename = `about.${lang}.md`;
    try {
      const raw = await readFile(path.join(seedDir, filename), "utf8");
      files.push({ filename, lang, type: "about", raw });
    } catch {
      // seed 檔不存在就略過
    }
  }

  return files;
}

/** 讀 token 檔(~/.cf_ingest_token);不存在回 null(→ dry-run)。 */
async function readToken() {
  const { readFile } = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const tokenPath = path.join(os.homedir(), ".cf_ingest_token");
  try {
    const raw = await readFile(tokenPath, "utf8");
    const token = raw.trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/** 對一批文字算 embedding,回傳向量陣列(1024 維)。 */
async function embedBatch(texts, token) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ text: texts }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Workers AI ${res.status} ${res.statusText}: ${detail.slice(0, 500)}`);
  }
  const json = await res.json();
  const data = json?.result?.data;
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new Error(
      `unexpected embedding response: got ${data?.length} vectors for ${texts.length} texts`,
    );
  }
  return data;
}

function summarize(records) {
  const bySource = {};
  for (const r of records) {
    bySource[r.metadata.source] = (bySource[r.metadata.source] || 0) + 1;
  }
  return bySource;
}

async function main() {
  const { writeFile, mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const here = path.dirname(fileURLToPath(import.meta.url));
  const askDir = path.resolve(here, "..");
  const cacheDir = path.join(askDir, ".cache");
  await mkdir(cacheDir, { recursive: true });

  const files = await collectFiles();
  const records = buildRecords(files);
  const bySource = summarize(records);

  console.log(`收集檔案數:${files.length}`);
  console.log(`產生 chunk 數:${records.length}`);
  console.log("各 source 條數:");
  for (const [source, count] of Object.entries(bySource).sort()) {
    console.log(`  ${source}: ${count}`);
  }

  const token = await readToken();

  // ── Dry-run:無 token → 不打 API,只輸出 chunks 預覽 ──
  if (!token) {
    const previewPath = path.join(cacheDir, "chunks.preview.json");
    const preview = records.map((r) => ({
      id: r.id,
      metadata: { ...r.metadata, text: undefined, textLen: r.text.length },
      text: r.text,
    }));
    await writeFile(previewPath, JSON.stringify(preview, null, 2), "utf8");
    console.log(`\n[dry-run] chunks 預覽已寫入:${previewPath}`);
    console.log(
      "token 缺,已 dry-run;放好 ~/.cf_ingest_token 後重跑可產生 vectors.ndjson",
    );
    return;
  }

  // 實跑需要 account id;沒設就明確報錯(不要拿空字串去打 API)。
  if (!ACCOUNT_ID) {
    console.error(
      "錯誤:未設 CF_ACCOUNT_ID 環境變數。請先 `export CF_ACCOUNT_ID=<你的 Cloudflare account id>` 再重跑。",
    );
    process.exit(1);
  }

  // ── 實跑:分批算 embedding → 寫 NDJSON ──
  const lines = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const vectors = await embedBatch(
      batch.map((r) => r.text),
      token,
    );
    batch.forEach((r, j) => {
      const values = vectors[j];
      if (!Array.isArray(values) || values.length !== 1024) {
        throw new Error(`chunk ${r.id} 向量維度異常:${values?.length}`);
      }
      lines.push(
        JSON.stringify({ id: r.id, values, metadata: r.metadata }),
      );
    });
    console.log(`  embedded ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`);
  }

  const outPath = path.join(cacheDir, "vectors.ndjson");
  await writeFile(outPath, lines.join("\n") + "\n", "utf8");

  console.log(`\n完成。總 chunk 數:${records.length}`);
  console.log(`輸出:${outPath}`);
  console.log("下一步(用 upsert 才會覆蓋既有 id;insert 會跳過已存在的 id):");
  console.log("  cd ask && npx wrangler vectorize upsert resume --file .cache/vectors.ndjson");
}

// 只有「直接執行」才跑 main;被 import(測試)時不執行。
// 用動態 import 取 node:url,避免在 Workers runtime(vitest)下靜態 import 失敗。
async function bootstrap() {
  if (typeof process === "undefined" || !process.argv?.[1]) return;
  const { pathToFileURL } = await import("node:url");
  if (import.meta.url !== pathToFileURL(process.argv[1]).href) return;
  try {
    await main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

bootstrap();
