// 回答模型:Claude Haiku(主)+ Workers AI llama(備援)的純函式與 Anthropic 呼叫。
// 檢索(bge-m3 / Vectorize)不在這裡,仍由 Workers AI 負責。

export const HAIKU_MODEL = "claude-haiku-5-5";
export const HAIKU_MAX_TOKENS = 600;          // 實測最長回答約 370 tokens;硬上限控成本
export const HAIKU_TIMEOUT_MS = 12_000;       // 等到回應標頭的上限,逾時退回 llama
export const HAIKU_TOTAL_MS = 30_000;         // 整段串流總時限(超過則已輸出內容保留、正常收尾)
export const DEFAULT_HAIKU_DAILY_CAP = 300;

export type AnswerModel = "haiku" | "llama";

/** 每日 Haiku 呼叫計數的 KV key(UTC 日期)。 */
export function haikuDayKey(date: string): string {
  return "haiku:" + date;
}

/** 解析環境變數的每日上限;缺值/非法 → 預設;允許 0(=強制備援)。 */
export function parseHaikuCap(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_HAIKU_DAILY_CAP;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_HAIKU_DAILY_CAP;
}

interface ChatMsg { role: "user" | "assistant"; content: string }

/** 向 Anthropic Messages API 要串流回應。非 2xx / 逾時 / 網路錯誤一律 throw(呼叫端退回 llama)。 */
export async function callHaiku(
  apiKey: string,
  system: string,
  messages: ChatMsg[],
  fetchImpl: typeof fetch = fetch,
): Promise<ReadableStream<Uint8Array>> {
  // 逾時只管「等標頭」;標頭到手後改成較長的總時限(不能讓 12s 的 signal 把正常長答案攔腰切斷)。
  const ac = new AbortController();
  let timer = setTimeout(() => ac.abort(), HAIKU_TIMEOUT_MS);
  try {
    const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: HAIKU_MAX_TOKENS,
        stream: true,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system,
        messages,
      }),
      signal: ac.signal,
    });
    if (!res.ok || !res.body) {
      // 不讀/不記 body:錯誤訊息可能含請求細節;只留狀態碼給上層 log。
      throw new Error("anthropic_" + res.status);
    }
    clearTimeout(timer);
    timer = setTimeout(() => ac.abort(), HAIKU_TOTAL_MS);
    return res.body;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

const enc = new TextEncoder();
const sse = (obj: unknown) => enc.encode("data: " + JSON.stringify(obj) + "\n\n");
const doneFrame = () => enc.encode("data: [DONE]\n\n"); // 每次新建:buffer 被消費後會 detach,不能共用

/** Anthropic SSE → 既有格式 `data: {"response":"<token>"}` 的增量解析器。 */
function createParser(refusalText: string) {
  const dec = new TextDecoder();
  let buf = "";
  let emitted = false;
  const handle = (line: string, out: Uint8Array[]) => {
    const t = line.trim();
    if (!t.startsWith("data:")) return;
    const payload = t.slice(5).trim();
    if (!payload) return;
    let ev: { type?: string; delta?: { type?: string; text?: string; stop_reason?: string } };
    try { ev = JSON.parse(payload); } catch { return; }
    if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
      emitted = true;
      out.push(sse({ response: ev.delta.text }));
    } else if (ev.type === "message_delta" && ev.delta?.stop_reason === "refusal" && !emitted) {
      emitted = true;
      out.push(sse({ response: refusalText }));
    }
  };
  return {
    push(chunk: Uint8Array): Uint8Array[] {
      const out: Uint8Array[] = [];
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) handle(l, out);
      return out;
    },
    end(): Uint8Array[] {
      const out: Uint8Array[] = [];
      if (buf) handle(buf, out);
      buf = "";
      return out;
    },
  };
}

/**
 * 先「讀到第一段實際內容」才算 Haiku 成功:串流在出任何文字前就結束/出錯
 * (例如 overloaded_error 事件、只有 ping)→ throw,呼叫端可退回 llama(此時標頭尚未送出)。
 * 之後轉成 `data: {"response":...}` ... `data: [DONE]`;中途出錯或逾時則保留已輸出內容並正常收尾。
 * refusal(Haiku 5.5 無伺服器端 fallback)→ 輸出固定婉拒句。
 */
export async function openHaikuAnswer(
  body: ReadableStream<Uint8Array>,
  refusalText: string,
): Promise<ReadableStream<Uint8Array>> {
  const reader = body.getReader();
  const parser = createParser(refusalText);
  let first: Uint8Array[] = [];
  let finished = false;
  try {
    while (first.length === 0) {
      const { value, done } = await reader.read();
      if (done) { first = parser.end(); finished = true; break; }
      first = parser.push(value);
    }
  } catch (e) {
    reader.cancel().catch(() => {});
    throw e;
  }
  if (first.length === 0) {
    reader.cancel().catch(() => {});
    throw new Error("haiku_empty");
  }
  return new ReadableStream<Uint8Array>({
    start(ctl) {
      for (const f of first) ctl.enqueue(f);
      if (finished) { ctl.enqueue(doneFrame()); ctl.close(); }
    },
    async pull(ctl) {
      // 一次 pull 必須至少 enqueue 一筆或 close,否則串流會卡住(半截 SSE 行不產生 frame)。
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) {
            for (const f of parser.end()) ctl.enqueue(f);
            ctl.enqueue(doneFrame());
            ctl.close();
            return;
          }
          const frames = parser.push(value);
          if (frames.length > 0) {
            for (const f of frames) ctl.enqueue(f);
            return;
          }
        }
      } catch {
        ctl.enqueue(doneFrame());
        ctl.close();
      }
    },
    cancel() {
      return reader.cancel().catch(() => {});
    },
  });
}
