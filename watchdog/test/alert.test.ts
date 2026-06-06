import { describe, it, expect } from "vitest";
import { shouldAlert } from "../src/index";

describe("shouldAlert", () => {
  it("錯誤率超標要告警", () => {
    expect(shouldAlert({ errorRate: 0.2, p95ms: 100 })).toBe(true);
  });
  it("正常不告警", () => {
    expect(shouldAlert({ errorRate: 0.01, p95ms: 100 })).toBe(false);
  });
  it("延遲超標要告警", () => {
    expect(shouldAlert({ errorRate: 0, p95ms: 2000 })).toBe(true);
  });
});
