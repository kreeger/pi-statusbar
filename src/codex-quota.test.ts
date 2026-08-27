import { describe, expect, it, vi } from "vitest";
import {
  CodexQuotaState,
  fetchCodexUsedPercent,
  parseUsedPercent,
} from "./codex-quota.js";

describe("codex quota", () => {
  it("parses a bounded rolling or spend-control used percent", () => {
    expect(
      parseUsedPercent({
        rateLimits: { primary: null, individualLimit: { remainingPercent: 25 } },
      }),
    ).toBe(75);
    expect(
      parseUsedPercent({ rateLimits: { primary: { usedPercent: 7 } } }),
    ).toBe(7);
    expect(
      parseUsedPercent({ rateLimits: { primary: { usedPercent: 7.5 } } }),
    ).toBeUndefined();
    expect(
      parseUsedPercent({ rateLimits: { individualLimit: { remainingPercent: -1 } } }),
    ).toBeUndefined();
  });

  it("fetches parsed usage and hides CLI failures", async () => {
    const readUsage = vi.fn().mockResolvedValue({
      rateLimits: { primary: null, individualLimit: { remainingPercent: 58 } },
    });
    expect(await fetchCodexUsedPercent(readUsage)).toBe(42);
    expect(readUsage).toHaveBeenCalledOnce();
    expect(
      await fetchCodexUsedPercent(
        vi.fn().mockRejectedValue(new Error("failed")),
      ),
    ).toBeUndefined();
  });

  it("prevents overlap, expires stale values, and requests a redraw", async () => {
    vi.useFakeTimers();
    let now = 0;
    let resolve: ((value: number) => void) | undefined;
    const fetcher = vi.fn(
      () =>
        new Promise<number>((r) => {
          resolve = r;
        }),
    );
    const state = new CodexQuotaState(fetcher, () => now, 1000, 500);
    const onComplete = vi.fn();
    state.startPolling(onComplete);
    state.startPolling();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve!(33);
    await vi.waitFor(() => expect(state.usedPercent).toBe(33));
    expect(onComplete).toHaveBeenCalledTimes(1);
    now = 501;
    expect(state.usedPercent).toBeUndefined();
    state.stopPolling();
    expect(state.isPolling).toBe(false);
    vi.useRealTimers();
  });
});
