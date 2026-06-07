import { describe, it, expect } from "vitest";
import {
  validateQuestion,
  detectLang,
  dedupeSources,
  buildPrompt,
  chunkText,
  type Source,
  type Chunk,
} from "./rag";

describe("validateQuestion", () => {
  it("accepts a normal question", () => {
    expect(validateQuestion("你做過什麼專案?")).toEqual({ ok: true });
  });

  it("rejects empty string", () => {
    expect(validateQuestion("")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects whitespace-only string (trim)", () => {
    expect(validateQuestion("   \n\t ")).toEqual({ ok: false, reason: "empty" });
  });

  it("accepts exactly 500 chars", () => {
    expect(validateQuestion("a".repeat(500))).toEqual({ ok: true });
  });

  it("rejects > 500 chars", () => {
    expect(validateQuestion("a".repeat(501))).toEqual({
      ok: false,
      reason: "too_long",
    });
  });
});

describe("detectLang", () => {
  it("detects Chinese", () => {
    expect(detectLang("你好嗎")).toBe("zh");
  });

  it("detects English", () => {
    expect(detectLang("What did you build?")).toBe("en");
  });

  it("detects zh when mixed with English", () => {
    expect(detectLang("Tell me about 專案")).toBe("zh");
  });

  it("treats empty as en", () => {
    expect(detectLang("")).toBe("en");
  });
});

describe("dedupeSources", () => {
  it("dedupes by source, preserving first-seen order", () => {
    const srcs: Source[] = [
      { source: "a", title: "A1" },
      { source: "b", title: "B1" },
      { source: "a", title: "A2" },
      { source: "c", title: "C1" },
      { source: "b", title: "B2" },
    ];
    expect(dedupeSources(srcs)).toEqual([
      { source: "a", title: "A1" },
      { source: "b", title: "B1" },
      { source: "c", title: "C1" },
    ]);
  });

  it("returns empty for empty input", () => {
    expect(dedupeSources([])).toEqual([]);
  });

  it("leaves already-unique list unchanged", () => {
    const srcs: Source[] = [
      { source: "x", title: "X" },
      { source: "y", title: "Y" },
    ];
    expect(dedupeSources(srcs)).toEqual(srcs);
  });
});

describe("buildPrompt", () => {
  const chunks: Chunk[] = [
    { text: "Built a URL shortener.", source: "resume.md", title: "Projects" },
    { text: "Used Cloudflare Workers.", source: "stack.md", title: "Stack" },
  ];

  it("system prompt enforces grounding, refusal, language, privacy (zh)", () => {
    const { system } = buildPrompt("你做過什麼?", chunks, "zh");
    expect(system).toContain("只能根據");
    expect(system).toContain("沒有");
    expect(system).toContain("中文");
    expect(system).not.toContain("make up");
  });

  it("english system prompt does not force 中文", () => {
    const { system } = buildPrompt("What did you do?", chunks, "en");
    expect(system).toContain("只能根據");
    expect(system).not.toContain("中文");
    expect(system).not.toContain("make up");
  });

  it("user prompt numbers the chunks and includes the question", () => {
    const { user } = buildPrompt("你做過什麼?", chunks, "zh");
    expect(user).toContain("Built a URL shortener.");
    expect(user).toContain("Used Cloudflare Workers.");
    expect(user).toContain("你做過什麼?");
    // numbered context
    expect(user).toMatch(/\[1\]/);
    expect(user).toMatch(/\[2\]/);
  });

  it("user prompt shows placeholder when no chunks", () => {
    const { user } = buildPrompt("anything", [], "zh");
    expect(user).toContain("(無相關片段)");
    expect(user).toContain("anything");
  });
});

describe("chunkText", () => {
  it("returns single element for short text", () => {
    expect(chunkText("hello world")).toEqual(["hello world"]);
  });

  it("splits on blank lines", () => {
    const out = chunkText("para one\n\npara two");
    expect(out).toEqual(["para one", "para two"]);
  });

  it("splits an over-long paragraph by sentence enders, staying near max", () => {
    // 10 sentences of ~30 chars each = ~300 chars, no blank lines.
    const sentence = "This is a sentence of length thirty. ";
    const long = sentence.repeat(10).trim();
    const out = chunkText(long, 200);
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) {
      expect(c.length).toBeLessThanOrEqual(220);
    }
    // round-trips all the sentence content
    expect(out.join(" ")).toContain("This is a sentence");
  });

  it("handles Chinese full-stop sentence splitting", () => {
    const s = "這是一個句子。".repeat(40); // 280 chars, single paragraph
    const out = chunkText(s, 200);
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) {
      expect(c.length).toBeLessThanOrEqual(220);
    }
  });

  it("drops empty paragraphs from collapsed blank lines", () => {
    const out = chunkText("a\n\n\n\nb");
    expect(out).toEqual(["a", "b"]);
  });
});
