export interface RawEntry {
  id: string;
  data: Record<string, unknown>;
  body?: string;
}

export interface LocalizedEntry {
  slug: string;
  data: Record<string, unknown>;
  body?: string;
  fallback: boolean;
}

export type Locale = "zh" | "en";

/**
 * 取某 locale 的內容。zh 為內容母體;請求 en 但缺該 slug 的 en 檔時,
 * 回退 zh 並標 fallback=true,確保頁面不破。
 */
export function resolveLocalized(
  entries: RawEntry[],
  locale: Locale,
): LocalizedEntry[] {
  const byLocale = (loc: string) =>
    new Map(
      entries
        .filter((e) => e.id.startsWith(loc + "/"))
        .map((e) => [e.id.slice(loc.length + 1), e] as const),
    );
  const zh = byLocale("zh");
  const want = locale === "zh" ? zh : byLocale("en");
  return [...zh.keys()].map((slug) => {
    const hit = want.get(slug);
    const src = hit ?? zh.get(slug)!;
    return {
      slug,
      data: src.data,
      body: src.body,
      fallback: !hit && locale !== "zh",
    };
  });
}
