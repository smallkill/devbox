import { defineConfig } from "astro/config";

// 靜態輸出,部署到 Cloudflare Pages。
export default defineConfig({
  output: "static",
});
