import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CodexQuotaState,
  fetchCodexUsedPercent,
  parseUsedPercent,
  readCodexAccessToken,
} from "./codex-quota.js";
import { CODEX_USAGE_ENDPOINT } from "./codex-quota.js";

function authFile(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-statusbar-codex-"));
  const path = join(dir, "auth.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
}

describe("codex quota", () => {
  it("reads access token and handles auth read failure", () => {
    const path = authFile({ tokens: { access_token: "test-token" } });
    expect(readCodexAccessToken(path)).toBe("test-token");
    expect(readCodexAccessToken("/missing/auth.json")).toBeUndefined();
  });

  it("parses only bounded integer used percent", () => {
    expect(
      parseUsedPercent({
        spend_control: { individual_limit: { used_percent: 7 } },
      }),
    ).toBe(7);
    expect(
      parseUsedPercent({
        spend_control: { individual_limit: { used_percent: 7.5 } },
      }),
    ).toBeUndefined();
    expect(
      parseUsedPercent({
        spend_control: { individual_limit: { used_percent: 101 } },
      }),
    ).toBeUndefined();
  });

  it("fetches only parsed usage and hides client failures", async () => {
    const path = authFile({ tokens: { access_token: "test-token" } });
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        spend_control: { individual_limit: { used_percent: 42 } },
      }),
    });
    expect(await fetchCodexUsedPercent(fetcher, path)).toBe(42);
    expect(fetcher).toHaveBeenCalledWith(
      CODEX_USAGE_ENDPOINT,
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );
    expect(
      await fetchCodexUsedPercent(
        vi.fn().mockRejectedValue(new Error("failed")),
        path,
      ),
    ).toBeUndefined();
  });

  it("handles timeout-equivalent abort and missing auth without request", async () => {
    const path = authFile({ tokens: { access_token: "test-token" } });
    const fetcher = vi
      .fn()
      .mockImplementation(
        (_url: string, options: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          ),
      );
    vi.useFakeTimers();
    const result = fetchCodexUsedPercent(fetcher, path);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await result).toBeUndefined();
    const missing = vi.fn();
    expect(
      await fetchCodexUsedPercent(missing, "/missing/auth.json"),
    ).toBeUndefined();
    expect(missing).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("prevents overlap, expires stale values, and cleans up", async () => {
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
    state.startPolling();
    state.startPolling();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve!(33);
    await vi.waitFor(() => expect(state.usedPercent).toBe(33));
    now = 501;
    expect(state.usedPercent).toBeUndefined();
    state.stopPolling();
    expect(state.isPolling).toBe(false);
    vi.useRealTimers();
  });
});
