import { describe, it, expect } from "vitest";
import { openHaikuAnswer, callHaiku, parseHaikuCap, haikuDayKey, HAIKU_MAX_TOKENS } from "./llm";
import { parseSSEAnswer } from "./rag";

const ev = (o: unknown) => "event: x\ndata: " + JSON.stringify(o) + "\n\n";
const enc = new TextEncoder();
function src(chunks: string[], errAfter = false): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]));
      else if (errAfter) return new Promise<void>((r) => setTimeout(() => { c.error(new Error("boom")); r(); }, 20));
      else c.close();
    },
  });
}
async function run(chunks: string[], refusal = "REFUSED", errAfter = false): Promise<string> {
  const s = await openHaikuAnswer(src(chunks, errAfter), refusal);
  return new Response(s).text();
}

describe("openHaikuAnswer", () => {
  it("converts text deltas (even split across chunks) into response frames + DONE", async () => {
    const a = ev({ type: "content_block_delta", delta: { type: "text_delta", text: "你好" } });
    const b = ev({ type: "content_block_delta", delta: { type: "text_delta", text: "世界" } });
    const out = await run([a.slice(0, 30), a.slice(30) + b.slice(0, 10), b.slice(10), ev({ type: "message_stop" })]);
    expect(parseSSEAnswer(out)).toBe("你好世界");
    expect(out.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });
  it("emits refusal text when stop_reason is refusal and nothing was streamed", async () => {
    const out = await run([ev({ type: "message_delta", delta: { stop_reason: "refusal" } })]);
    expect(parseSSEAnswer(out)).toBe("REFUSED");
  });
  it("throws (so caller can fall back) when stream has no content, e.g. error event", async () => {
    await expect(run(["data: not-json\n\n", ev({ type: "ping" }), ev({ type: "error", error: { type: "overloaded_error" } })])).rejects.toThrow("haiku_empty");
  });
  it("throws when source errors before any text", async () => {
    await expect(run([], "R", true)).rejects.toThrow("boom");
  });
  it("keeps already-streamed text and ends cleanly if the source errors mid-stream", async () => {
    const a = ev({ type: "content_block_delta", delta: { type: "text_delta", text: "部分" } });
    const out = await run([a], "R", true);
    expect(parseSSEAnswer(out)).toBe("部分");
    expect(out.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });
});

describe("callHaiku", () => {
  it("sends capped, streaming request with key header and returns body", async () => {
    let seen: { headers: Record<string, string>; body: Record<string, unknown> } | undefined;
    const f = (async (_u: string, init: RequestInit) => {
      seen = { headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;
    const body = await callHaiku("k", "sys", [{ role: "user", content: "q" }], f);
    expect(body).toBeTruthy();
    expect(seen!.headers["x-api-key"]).toBe("k");
    expect(seen!.body.max_tokens).toBe(HAIKU_MAX_TOKENS);
    expect(seen!.body.stream).toBe(true);
    expect(seen!.body.model).toBe("claude-haiku-5-5");
  });
  it("throws on non-2xx without leaking body", async () => {
    const f = (async () => new Response("secret detail", { status: 529 })) as unknown as typeof fetch;
    await expect(callHaiku("k", "s", [], f)).rejects.toThrow("anthropic_529");
  });
});

describe("cap helpers", () => {
  it("parses cap with default and zero allowed", () => {
    expect(parseHaikuCap(undefined)).toBe(300);
    expect(parseHaikuCap("0")).toBe(0);
    expect(parseHaikuCap("50")).toBe(50);
    expect(parseHaikuCap("abc")).toBe(300);
    expect(parseHaikuCap("-1")).toBe(300);
  });
  it("day key", () => expect(haikuDayKey("2026-10-24")).toBe("haiku:2026-10-24"));
});
