import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

// 在 Workers runtime 內跑測試,並用 wrangler.toml 的 bindings(D1、Analytics Engine)。
// isolatedStorage:每個測試檔有獨立的 D1 狀態。
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        isolatedStorage: true,
        wrangler: { configPath: "./wrangler.toml" },
        // 測試用的建立 token(正式環境用 wrangler secret put CREATE_TOKEN)。
        miniflare: {
          bindings: { CREATE_TOKEN: "test-token" },
        },
      },
    },
  },
});
