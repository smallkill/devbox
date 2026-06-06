import { describe, it, expect } from "vitest";
import { makeSlug, isValidUrl } from "../src/slug";

describe("makeSlug", () => {
  it("回傳 6 碼英數字串", () => {
    const s = makeSlug();
    expect(s).toMatch(/^[0-9a-zA-Z]{6}$/);
  });
  it("兩次呼叫不相同", () => {
    expect(makeSlug()).not.toBe(makeSlug());
  });
});

describe("isValidUrl", () => {
  it("接受 https 網址", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
  });
  it("拒絕非 http(s)", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("not a url")).toBe(false);
  });
});
