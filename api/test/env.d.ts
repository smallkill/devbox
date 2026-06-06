import type { Env } from "../src/index";

// 讓測試裡的 `env`(來自 cloudflare:test)帶有 wrangler.toml 宣告的 bindings 型別。
declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}
