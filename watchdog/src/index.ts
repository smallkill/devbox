import { fetchMetrics, type Metrics } from "./metrics";

export type { Metrics };

export interface Env {
  TELEGRAM_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  // Analytics Engine SQL API 用(查 REQUESTS_DATASET),同 api Worker 的 secret 名稱慣例,
  // 一組 `wrangler secret put` 可複製貼到兩個 Worker。
  CF_ACCOUNT_ID?: string;
  AE_API_TOKEN?: string;
}

const ERROR_THRESHOLD = 0.05;
const P95_THRESHOLD_MS = 1000;
// 30 分鐘窗至少要有這麼多請求才評估告警:流量稀疏時單一冷啟動請求就會
// 成為 p95(2026-07-04 部署當天 4 個測試請求含一次冷啟動 → p95=1293ms 誤報)。
const MIN_SAMPLES = 20;

// 必須與 api/wrangler.toml 的 REQUESTS binding 的 dataset 名稱完全一致。
const REQUESTS_DATASET = "devbox_requests";

/** 純函式:樣本足夠時依門檻判斷是否該告警;樣本不足一律不告警。 */
export function shouldAlert(m: Metrics): boolean {
  if (m.total < MIN_SAMPLES) return false;
  return m.errorRate > ERROR_THRESHOLD || m.p95ms > P95_THRESHOLD_MS;
}

async function notify(env: Env, text: string): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
    },
  );
  // 告警管道本身靜默失敗最諷刺 — 失敗時留 log(Workers tail 看得到)。
  if (!res.ok) {
    console.error(`Telegram notify failed: ${res.status} ${await res.text()}`);
  }
}

export default {
  async scheduled(_ctrl: ScheduledController, env: Env): Promise<void> {
    const m = await fetchMetrics(env, REQUESTS_DATASET);
    if (shouldAlert(m)) {
      await notify(
        env,
        `⚠️ devbox 異常:errorRate=${m.errorRate}, p95=${m.p95ms}ms, n=${m.total}`,
      );
    }
  },
};
