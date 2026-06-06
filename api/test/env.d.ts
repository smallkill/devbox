/// <reference types="@cloudflare/vitest-pool-workers" />
import type { Env } from "../src/index";

// 讓測試裡的 `env`(來自 cloudflare:test)帶有 wrangler.toml 宣告的 bindings 型別。
declare module "cloudflare:test" {
  // 合併進 pool 的 ProvidedEnv,讓 env.DB / env.CLICKS 帶型別。
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProvidedEnv extends Env {}
}
