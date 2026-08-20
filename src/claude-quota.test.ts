import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CLAUDE_USAGE_ENDPOINT,
  ClaudeQuotaState,
  fetchClaudeUsedPercent,
  parseSpendPercent,
  readClaudeAccessToken,
} from "./claude-quota.js";

function credentialsFile(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-statusbar-claude-"));
  const path = join(dir, ".credentials.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
}

describe("claude quota", () => {
  it("reads access token from a plaintext credentials file and handles read failure", () => {
    const path = credentialsFile({ claudeAiOauth: { accessToken: "test-token" } });
    expect(readClaudeAccessToken(() => undefined, path)).toBe("test-token");
    expect(readClaudeAccessToken(() => undefined, "/missing/.credentials.json")).toBeUndefined();
  });

  it("prefers a keychain token over the plaintext file when both are present", () => {
    const path = credentialsFile({ claudeAiOauth: { accessToken: "file-token" } });
    const readKeychain = () =>
      JSON.stringify({ claudeAiOauth: { accessToken: "keychain-token" } });
    expect(readClaudeAccessToken(readKeychain, path)).toBe("keychain-token");
  });

  it("falls back to the file when the keychain read throws or returns nothing usable", () => {
    const path = credentialsFile({ claudeAiOauth: { accessToken: "file-token" } });
    expect(
      readClaudeAccessToken(() => {
        throw new Error("no keychain");
      }, path),
    ).toBe("file-token");
    expect(readClaudeAccessToken(() => "not json", path)).toBe("file-token");
    expect(readClaudeAccessToken(() => undefined, path)).toBe("file-token");
  });

  it("parses spend percent only when spend is enabled and percent is a bounded integer", () => {
    expect(parseSpendPercent({ spend: { enabled: true, percent: 7 } })).toBe(7);
    expect(parseSpendPercent({ spend: { enabled: false, percent: 7 } })).toBeUndefined();
    expect(parseSpendPercent({ spend: { enabled: true, percent: 7.5 } })).toBeUndefined();
    expect(parseSpendPercent({ spend: { enabled: true, percent: 101 } })).toBeUndefined();
    expect(parseSpendPercent(undefined)).toBeUndefined();
  });

  it("fetches only parsed usage and hides client failures", async () => {
    const path = credentialsFile({ claudeAiOauth: { accessToken: "test-token" } });
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ spend: { enabled: true, percent: 42 } }),
    });
    expect(await fetchClaudeUsedPercent(fetcher, () => undefined, path)).toBe(42);
    expect(fetcher).toHaveBeenCalledWith(
      CLAUDE_USAGE_ENDPOINT,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
    expect(
      await fetchClaudeUsedPercent(
        vi.fn().mockRejectedValue(new Error("failed")),
        () => undefined,
        path,
      ),
    ).toBeUndefined();
  });

  it("handles timeout-equivalent abort and missing auth without request", async () => {
    const path = credentialsFile({ claudeAiOauth: { accessToken: "test-token" } });
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
    const result = fetchClaudeUsedPercent(fetcher, () => undefined, path);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await result).toBeUndefined();
    const missing = vi.fn();
    expect(
      await fetchClaudeUsedPercent(missing, () => undefined, "/missing/.credentials.json"),
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
    const state = new ClaudeQuotaState(fetcher, () => now, 1000, 500);
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
