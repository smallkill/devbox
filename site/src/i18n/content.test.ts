import { describe, it, expect } from "vitest";
import { resolveLocalized } from "./content";

const entries = [
  { id: "zh/devbox", data: { title: "中文" } },
  { id: "zh/foo", data: { title: "只有中文" } },
  { id: "en/devbox", data: { title: "English" } },
];

describe("resolveLocalized", () => {
  it("en 取 en 檔", () => {
    const r = resolveLocalized(entries, "en");
    expect(r.find((e) => e.slug === "devbox")!.data.title).toBe("English");
  });
  it("en 缺檔回退 zh,並標 fallback", () => {
    const r = resolveLocalized(entries, "en");
    const foo = r.find((e) => e.slug === "foo")!;
    expect(foo.data.title).toBe("只有中文");
    expect(foo.fallback).toBe(true);
  });
  it("zh 一律取 zh、不標 fallback", () => {
    const r = resolveLocalized(entries, "zh");
    expect(r.map((e) => e.slug).sort()).toEqual(["devbox", "foo"]);
    expect(r.every((e) => e.fallback === false)).toBe(true);
  });
});
