export interface Metrics {
  errorRate: number;
  p95ms: number;
}

export interface Env {
  TELEGRAM_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

const ERROR_THRESHOLD = 0.05;
const P95_THRESHOLD_MS = 1000;

/** 純函式:依門檻判斷是否該告警。 */
export function shouldAlert(m: Metrics): boolean {
  return m.errorRate > ERROR_THRESHOLD || m.p95ms > P95_THRESHOLD_MS;
}

/**
 * 取得近期指標。Phase 6 接 Analytics Engine SQL API;
 * 在此之前回安全值(不誤觸告警)。
 */
async function fetchMetrics(): Promise<Metrics> {
  return { errorRate: 0, p95ms: 0 };
}

async function notify(env: Env, text: string): Promise<void> {
  await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
    },
  );
}

export default {
  async scheduled(_ctrl: ScheduledController, env: Env): Promise<void> {
    const m = await fetchMetrics();
    if (shouldAlert(m)) {
      await notify(
        env,
        `⚠️ devbox 異常:errorRate=${m.errorRate}, p95=${m.p95ms}ms`,
      );
    }
  },
};
