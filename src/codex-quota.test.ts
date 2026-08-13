import { describe, expect, it, vi } from "vitest";
import { CodexQuotaState, parseUsedPercent } from "./codex-quota.js";

describe("codex quota", () => {
  it("parses only bounded integer used percent", () => {
    expect(parseUsedPercent({ spend_control: { individual_limit: { used_percent: 7 } } })).toBe(7);
    expect(parseUsedPercent({ spend_control: { individual_limit: { used_percent: 7.5 } } })).toBeUndefined();
    expect(parseUsedPercent({ spend_control: { individual_limit: { used_percent: 101 } } })).toBeUndefined();
  });

  it("polls asynchronously and expires stale values", async () => {
    let now = 0;
    const fetcher = vi.fn().mockResolvedValue(33);
    const state = new CodexQuotaState(fetcher, () => now, 1000, 500);
    state.startPolling();
    await vi.waitFor(() => expect(state.usedPercent).toBe(33));
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 501;
    expect(state.usedPercent).toBeUndefined();
    state.stopPolling();
    expect(state.isPolling).toBe(false);
  });
});
