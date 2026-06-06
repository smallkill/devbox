export interface RawEntry<T> {
  id: string;
  data: T;
  body?: string;
}

export interface LocalizedEntry<T> {
  slug: string;
  data: T;
  body?: string;
  fallback: boolean;
}

export type Locale = "zh" | "en";

/**
 * 取某 locale 的內容。zh 為內容母體;請求 en 但缺該 slug 的 en 檔時,
 * 回退 zh 並標 fallback=true,確保頁面不破。泛型保留 collection 的 data 型別。
 */
export function resolveLocalized<T>(
  entries: RawEntry<T>[],
  locale: Locale,
): LocalizedEntry<T>[] {
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
