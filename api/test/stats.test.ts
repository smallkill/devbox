import { describe, it, expect } from "vitest";
import { buildStatsQuery } from "../src/stats";

describe("buildStatsQuery", () => {
  it("產生查近 24h 點擊聚合的 SQL", () => {
    const sql = buildStatsQuery("devbox_clicks");
    expect(sql).toContain("devbox_clicks");
    expect(sql.toLowerCase()).toContain("count");
    expect(sql).toContain("24");
  });
});
