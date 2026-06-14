import { describe, it, expect } from "vitest";
import {
  chunkText,
  buildRecords,
  describeFile,
  splitFrontmatter,
  slugFromFilename,
  fmField,
  fmList,
  normalizePeriod,
} from "./ingest.mjs";

describe("fmList", () => {
  const fm = [
    "org: ACME",
    "highlights:",
    "  - 'first <strong>bold</strong> item with <a href=\"x\">link text</a>'",
    "  - second plain item",
    "tech: [A, B]",
  ].join("\n");
  it("抓 highlights 清單項目", () => {
    expect(fmList(fm, "highlights")).toEqual([
      "first bold item with link text",
      "second plain item",
    ]);
  });
  it("去 HTML 標籤、保留可見文字", () => {
    expect(fmList(fm, "highlights")[0]).not.toMatch(/[<>]/);
  });
  it("沒有該欄位 → 空陣列", () => {
    expect(fmList("org: X\ntech: [A]", "highlights")).toEqual([]);
  });
  it("highlights 是最後欄位(含結尾空行)→ 不漏項", () => {
    const f = "org: X\nhighlights:\n  - a\n  - b\n";
    expect(fmList(f, "highlights")).toEqual(["a", "b"]);
  });
  it("highlights 後面還有別的頂層 key → 不吃到後面", () => {
    const f = "highlights:\n  - a\n  - b\norder: 3\ntech: [Z]";
    expect(fmList(f, "highlights")).toEqual(["a", "b"]);
  });
  it("不誤刪非標籤的 < (如 <5ms)", () => {
    const f = "highlights:\n  - latency <5ms after tuning\norder: 1";
    expect(fmList(f, "highlights")).toEqual(["latency <5ms after tuning"]);
  });
  it("describeFile 把 highlights 併入文字(experience 無 body)", () => {
    const raw = `---\norg: ACME\nrole: Eng\nhighlights:\n  - 'patent <a href="u">TWI844132B</a>'\n  - did stuff\n---\n`;
    const { text } = describeFile({ filename: "3-acme.md", lang: "zh", type: "experience", raw });
    expect(text).toContain("patent TWI844132B");
    expect(text).toContain("did stuff");
    expect(text).not.toMatch(/<a /);
  });
});

describe("normalizePeriod", () => {
  it("zh:點格式 → 明確年月(避免小模型吃掉年份)", () => {
    expect(normalizePeriod("2023.06 – 2026.04", "zh")).toBe("2023年6月至2026年4月");
  });
  it("zh:現在 → 至今", () => {
    expect(normalizePeriod("2026.04 – 現在", "zh")).toBe("2026年4月至今");
  });
  it("en:點格式 → 月名", () => {
    expect(normalizePeriod("2023.06 – 2026.04", "en")).toBe("June 2023 to April 2026");
  });
  it("英文月名格式不符正則 → 原樣不動", () => {
    expect(normalizePeriod("Jun 2023 – Apr 2026", "en")).toBe("Jun 2023 – Apr 2026");
  });
  it("純年份 → 原樣不動", () => {
    expect(normalizePeriod("2019 – 2020", "zh")).toBe("2019 – 2020");
    expect(normalizePeriod("2026", "zh")).toBe("2026");
  });
  it("空字串 → 原樣", () => {
    expect(normalizePeriod("", "zh")).toBe("");
  });
});

describe("chunkText", () => {
  it("returns single element for short text", () => {
    expect(chunkText("短短一句話。")).toEqual(["短短一句話。"]);
  });

  it("splits on blank lines into paragraphs", () => {
    expect(chunkText("第一段。\n\n第二段。")).toEqual(["第一段。", "第二段。"]);
  });

  it("respects the max bound by splitting long paragraphs at sentence ends", () => {
    // 三句各約 40 字,max=50 → 應切成多段,每段不超過(允許略超一句)。
    const sentence = "這是一個長長的句子用來測試切分上限是否生效喔。"; // ~23 chars
    const text = sentence.repeat(5); // ~115 chars, 5 sentences, no blank line
    const chunks = chunkText(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
    // 每個 chunk 都是一或多句貪婪打包,單句長度 < max,故不會超過 max + 單句。
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(50 + sentence.length);
    }
  });

  it("handles English sentence splitting", () => {
    const s = "This is sentence one. This is sentence two. This is sentence three.";
    const chunks = chunkText(s, 30);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("splitFrontmatter", () => {
  it("extracts frontmatter and body", () => {
    const raw = "---\ntitle: Hi\norg: ACME\n---\nbody line one\n\nbody line two";
    const { frontmatter, body } = splitFrontmatter(raw);
    expect(frontmatter).toContain("title: Hi");
    expect(body).toBe("body line one\n\nbody line two");
  });

  it("returns empty frontmatter when none present", () => {
    const { frontmatter, body } = splitFrontmatter("just a body");
    expect(frontmatter).toBe("");
    expect(body).toBe("just a body");
  });
});

describe("slugFromFilename", () => {
  it("strips .md and numeric prefix", () => {
    expect(slugFromFilename("2-moxa.md")).toBe("moxa");
    expect(slugFromFilename("avm-3d.md")).toBe("avm-3d");
    expect(slugFromFilename("about.zh.md")).toBe("about.zh");
  });
});

describe("fmField", () => {
  it("reads a field and strips quotes", () => {
    expect(fmField('period: "2026"', "period")).toBe("2026");
    expect(fmField("org: Moxa", "org")).toBe("Moxa");
    expect(fmField("org: Moxa", "title")).toBe("");
  });
});

describe("describeFile", () => {
  it("uses title from frontmatter for projects", () => {
    const d = describeFile({
      filename: "devbox.md",
      lang: "en",
      type: "project",
      raw: "---\ntitle: devbox SaaS\nrole: Personal\nperiod: 2026\n---\nBody text here.",
    });
    expect(d.source).toBe("devbox");
    expect(d.lang).toBe("en");
    expect(d.title).toBe("devbox SaaS");
    expect(d.type).toBe("project");
    expect(d.text).toContain("devbox SaaS");
    expect(d.text).toContain("Body text here.");
  });

  it("falls back to org as title for experience (no title field)", () => {
    const d = describeFile({
      filename: "2-moxa.md",
      lang: "zh",
      type: "experience",
      raw: "---\norg: Moxa\nrole: SSE\nperiod: 2023\n---\nDid CI/CD.",
    });
    expect(d.source).toBe("moxa");
    expect(d.title).toBe("Moxa");
    expect(d.text).toContain("Moxa");
  });

  it("uses 'about' source for seed files", () => {
    const d = describeFile({
      filename: "about.zh.md",
      lang: "zh",
      type: "about",
      raw: "---\ntitle: 關於我\n---\n自我介紹內容。",
    });
    expect(d.source).toBe("about");
    expect(d.type).toBe("about");
    expect(d.title).toBe("關於我");
  });
});

describe("buildRecords", () => {
  const files = [
    {
      filename: "2-moxa.md",
      lang: "zh",
      type: "experience",
      raw: "---\norg: Moxa\nrole: SSE\nperiod: 2023\n---\n第一段內容。\n\n第二段內容。",
    },
    {
      filename: "devbox.md",
      lang: "en",
      type: "project",
      raw: "---\ntitle: devbox\nperiod: 2026\n---\nProject body.",
    },
  ];

  it("produces correct metadata source/lang/type", () => {
    const records = buildRecords(files);
    const moxa = records.find((r) => r.metadata.source === "moxa");
    expect(moxa.metadata.lang).toBe("zh");
    expect(moxa.metadata.type).toBe("experience");
    expect(moxa.metadata.title).toBe("Moxa");

    const devbox = records.find((r) => r.metadata.source === "devbox");
    expect(devbox.metadata.lang).toBe("en");
    expect(devbox.metadata.type).toBe("project");
  });

  it("uses id format `${source}-${lang}-${index}`", () => {
    const records = buildRecords(files);
    const moxaIds = records
      .filter((r) => r.metadata.source === "moxa")
      .map((r) => r.id);
    expect(moxaIds[0]).toBe("moxa-zh-0");
    // 兩段 → 至少兩個 chunk → moxa-zh-1 存在
    expect(moxaIds).toContain("moxa-zh-1");

    const devbox = records.find((r) => r.metadata.source === "devbox");
    expect(devbox.id).toBe("devbox-en-0");
  });

  it("stores chunk text in metadata.text", () => {
    const records = buildRecords(files);
    for (const r of records) {
      expect(r.metadata.text).toBe(r.text);
    }
  });
});
