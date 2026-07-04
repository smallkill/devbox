import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, vi, beforeAll } from "vitest";
import worker, { type Env } from "../src/index";

// 驗證 fetch 的側錄包裝(見 src/index.ts):不影響回應內容,且 handleRequest
// 拋錯時例外原樣往外拋(不被 writeDataPoint 的 try/catch 吞掉)。
describe("REQUESTS 側錄 wrapper", () => {
  beforeAll(async () => {
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS links (slug TEXT PRIMARY KEY, url TEXT NOT NULL, created_at INTEGER NOT NULL)",
    );
  });

  it("不改變正常回應的 status/body", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(
      new Request("https://x/api/stats"),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const body = await res.json<{ links: number }>();
    expect(typeof body.links).toBe("number");
  });

  it("正常回應仍側錄一筆 status/latency 到 REQUESTS(finding: 只測過拋錯路徑,漏了成功路徑)", async () => {
    const ctx = createExecutionContext();
    const writeDataPoint = vi.fn();
    const spiedEnv = { ...env, REQUESTS: { writeDataPoint } } as unknown as Env;

    const res = await worker.fetch(
      new Request("https://x/api/stats"),
      spiedEnv,
      ctx,
    );
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    const point = writeDataPoint.mock.calls[0][0] as {
      blobs: string[];
      doubles: number[];
    };
    expect(point.blobs).toEqual(["/api/stats"]);
    expect(point.doubles[0]).toBe(200); // status
    expect(point.doubles[1]).toBeGreaterThanOrEqual(0); // latency ms
    expect(Number.isFinite(point.doubles[1])).toBe(true);
  });

  it("handleRequest 拋錯時例外仍往外拋,且嘗試側錄一筆 status=500", async () => {
    const ctx = createExecutionContext();
    const writeDataPoint = vi.fn();
    const brokenEnv = {
      ...env,
      DB: {
        prepare() {
          throw new Error("boom");
        },
      },
      REQUESTS: { writeDataPoint },
    } as unknown as Env;

    // /abc123 命中 SLUG_RE → 轉址分支呼叫 env.DB.prepare(...),broken DB 使其同步拋錯。
    await expect(
      worker.fetch(new Request("https://x/abc123"), brokenEnv, ctx),
    ).rejects.toThrow("boom");

    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    const point = writeDataPoint.mock.calls[0][0] as {
      blobs: string[];
      doubles: number[];
    };
    expect(point.blobs).toEqual(["/abc123"]);
    expect(point.doubles[0]).toBe(500);
  });

  it("writeDataPoint 本身拋錯不影響回應(側錄失敗被吞)", async () => {
    const ctx = createExecutionContext();
    const brokenEnv = {
      ...env,
      REQUESTS: {
        writeDataPoint: () => {
          throw new Error("ae down");
        },
      },
    } as unknown as Env;
    const res = await worker.fetch(
      new Request("https://x/api/stats"),
      brokenEnv,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
  });
});
