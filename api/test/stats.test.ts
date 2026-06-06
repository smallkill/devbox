import { describe, it, expect } from "vitest";
import {
  buildTopLinksQuery,
  buildTotalClicksQuery,
  parseRows,
  toTopLinks,
} from "../src/stats";

describe("buildTopLinksQuery", () => {
  it("產生查近 24h Top 連結的 SQL", () => {
    const sql = buildTopLinksQuery("devbox_clicks");
    expect(sql).toContain("devbox_clicks");
    expect(sql.toLowerCase()).toContain("count");
    expect(sql).toContain("24");
    expect(sql).toContain("LIMIT 10");
  });
});

describe("buildTotalClicksQuery", () => {
  it("產生查近 24h 總點擊的 SQL", () => {
    const sql = buildTotalClicksQuery("devbox_clicks");
    expect(sql).toContain("devbox_clicks");
    expect(sql.toLowerCase()).toContain("count");
    expect(sql).not.toContain("GROUP BY");
  });
});

describe("parseRows", () => {
  it("取出 data 陣列", () => {
    expect(parseRows({ data: [{ slug: "a", clicks: 3 }] })).toEqual([
      { slug: "a", clicks: 3 },
    ]);
  });
  it("格式不符回空陣列", () => {
    expect(parseRows(null)).toEqual([]);
    expect(parseRows({})).toEqual([]);
    expect(parseRows("oops")).toEqual([]);
  });
});

describe("toTopLinks", () => {
  it("把字串數值正規化成 number", () => {
    expect(toTopLinks([{ slug: "abc", clicks: "5" }])).toEqual([
      { slug: "abc", clicks: 5 },
    ]);
  });
  it("缺欄位有預設值", () => {
    expect(toTopLinks([{}])).toEqual([{ slug: "", clicks: 0 }]);
  });
});
