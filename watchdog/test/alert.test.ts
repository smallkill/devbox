import { describe, it, expect } from "vitest";
import { shouldAlert } from "../src/index";

describe("shouldAlert", () => {
  it("錯誤率超標要告警", () => {
    expect(shouldAlert({ errorRate: 0.2, p95ms: 100, total: 100 })).toBe(true);
  });
  it("正常不告警", () => {
    expect(shouldAlert({ errorRate: 0.01, p95ms: 100, total: 100 })).toBe(false);
  });
  it("延遲超標要告警", () => {
    expect(shouldAlert({ errorRate: 0, p95ms: 2000, total: 100 })).toBe(true);
  });
  it("樣本不足(<MIN_SAMPLES)即使超標也不告警(冷啟動誤報防護)", () => {
    // 2026-07-04 實際誤報案例:4 個請求含一次冷啟動 → p95=1293ms
    expect(shouldAlert({ errorRate: 0, p95ms: 1293, total: 4 })).toBe(false);
    expect(shouldAlert({ errorRate: 1, p95ms: 9999, total: 19 })).toBe(false);
  });
  it("樣本剛好到門檻(=20)就正常評估", () => {
    expect(shouldAlert({ errorRate: 0, p95ms: 2000, total: 20 })).toBe(true);
    expect(shouldAlert({ errorRate: 0.01, p95ms: 100, total: 20 })).toBe(false);
  });
});
