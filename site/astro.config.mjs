import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// 靜態輸出 + i18n:中文於 `/`,英文於 `/en`。
export default defineConfig({
  site: "https://derek-chen.pages.dev",
  output: "static",
  i18n: {
    defaultLocale: "zh",
    locales: ["zh", "en"],
    routing: { prefixDefaultLocale: false },
  },
  // sitemap:build 自動產 sitemap-index.xml + sitemap-0.xml,
  // 並依站台 i18n 設定為每頁加上 zh-Hant / en 的 hreflang alternates。
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: "zh",
        locales: { zh: "zh-Hant", en: "en" },
      },
    }),
  ],
});
