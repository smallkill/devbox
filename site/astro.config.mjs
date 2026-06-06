import { defineConfig } from "astro/config";

// 靜態輸出 + i18n:中文於 `/`,英文於 `/en`。
export default defineConfig({
  output: "static",
  i18n: {
    defaultLocale: "zh",
    locales: ["zh", "en"],
    routing: { prefixDefaultLocale: false },
  },
});
