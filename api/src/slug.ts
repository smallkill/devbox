const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * 產生 6 碼隨機英數 slug,用 crypto 確保不可預測。
 * 用 rejection sampling 丟棄會造成模偏差的位元組(256 非 62 的倍數),
 * 讓每個字元等機率。
 */
export function makeSlug(len = 6): string {
  const N = ALPHABET.length; // 62
  const limit = Math.floor(256 / N) * N; // 248:>= 此值的位元組丟棄
  let out = "";
  while (out.length < len) {
    const bytes = new Uint8Array(len - out.length);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limit) out += ALPHABET[b % N];
      if (out.length === len) break;
    }
  }
  return out;
}

/** 僅接受 http/https 網址,擋掉 javascript: 等危險 scheme。 */
export function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
