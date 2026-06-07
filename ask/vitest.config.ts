import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

// 在 Workers runtime 內跑測試,並用 wrangler.toml 的 bindings(AI、Vectorize、KV)。
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        isolatedStorage: true,
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
