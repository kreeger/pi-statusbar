import { execFileSync } from "node:child_process";
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

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

function credentialsFile(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-statusbar-claude-"));
  const path = join(dir, ".credentials.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
}

const noPiAuth = () => undefined;
const noKeychain = () => undefined;

describe("claude quota", () => {
  it("prefers pi's own auth.json token over keychain and the credentials file", () => {
    const path = credentialsFile({ claudeAiOauth: { accessToken: "file-token" } });
    const readPiAuth = () => JSON.stringify({ anthropic: { access: "pi-token" } });
    const readKeychain = () =>
      JSON.stringify({ claudeAiOauth: { accessToken: "keychain-token" } });
    expect(readClaudeAccessToken(readPiAuth, readKeychain, path)).toBe("pi-token");
  });

  it("falls back to keychain when pi auth.json is missing or unusable", () => {
    const path = credentialsFile({ claudeAiOauth: { accessToken: "file-token" } });
    const readKeychain = () =>
      JSON.stringify({ claudeAiOauth: { accessToken: "keychain-token" } });
    expect(readClaudeAccessToken(noPiAuth, readKeychain, path)).toBe("keychain-token");
    expect(
      readClaudeAccessToken(
        () => {
          throw new Error("no pi auth");
        },
        readKeychain,
        path,
      ),
    ).toBe("keychain-token");
    expect(readClaudeAccessToken(() => "not json", readKeychain, path)).toBe(
      "keychain-token",
    );
  });

  it("falls back to the plaintext credentials file when pi auth.json and keychain are unusable", () => {
    const path = credentialsFile({ claudeAiOauth: { accessToken: "file-token" } });
    expect(readClaudeAccessToken(noPiAuth, noKeychain, path)).toBe("file-token");
    expect(
      readClaudeAccessToken(
        noPiAuth,
        () => {
          throw new Error("no keychain");
        },
        path,
      ),
    ).toBe("file-token");
    expect(readClaudeAccessToken(noPiAuth, () => "not json", path)).toBe("file-token");
  });

  it("returns undefined when no source has a usable token", () => {
    expect(
      readClaudeAccessToken(noPiAuth, noKeychain, "/missing/.credentials.json"),
    ).toBeUndefined();
  });

  it.runIf(process.platform === "darwin")(
    "pipes the keychain lookup's stderr instead of forwarding it to the terminal",
    () => {
      const mockedExecFileSync = vi.mocked(execFileSync);
      mockedExecFileSync.mockReset();
      mockedExecFileSync.mockImplementation(() => {
        throw new Error("item not found");
      });

      expect(
        readClaudeAccessToken(noPiAuth, undefined, "/missing/.credentials.json"),
      ).toBeUndefined();

      expect(mockedExecFileSync).toHaveBeenCalledTimes(1);
      expect(mockedExecFileSync.mock.calls[0]?.[2]).toMatchObject({
        stdio: ["ignore", "pipe", "pipe"],
      });
    },
  );

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
    expect(
      await fetchClaudeUsedPercent(fetcher, noPiAuth, noKeychain, path),
    ).toBe(42);
    expect(fetcher).toHaveBeenCalledWith(
      CLAUDE_USAGE_ENDPOINT,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
    expect(
      await fetchClaudeUsedPercent(
        vi.fn().mockRejectedValue(new Error("failed")),
        noPiAuth,
        noKeychain,
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
    const result = fetchClaudeUsedPercent(fetcher, noPiAuth, noKeychain, path);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await result).toBeUndefined();
    const missing = vi.fn();
    expect(
      await fetchClaudeUsedPercent(
        missing,
        noPiAuth,
        noKeychain,
        "/missing/.credentials.json",
      ),
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
    const state = new ClaudeQuotaState(fetcher, () => now, 1000, 500, () => "test-token");
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

  it("resolves the token once and reuses it while polls succeed", async () => {
    vi.useFakeTimers();
    const readToken = vi.fn(() => "memo-token");
    const fetcher = vi.fn(
      async (token: string) => (token === "memo-token" ? 10 : undefined),
    );
    const state = new ClaudeQuotaState(fetcher, () => 0, 1000, 500, readToken);
    state.startPolling();
    await vi.advanceTimersByTimeAsync(0);
    expect(readToken).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(readToken).toHaveBeenCalledTimes(1);
    state.stopPolling();
    vi.useRealTimers();
  });

  it("re-resolves the token after a poll yields no value", async () => {
    vi.useFakeTimers();
    const readToken = vi.fn(() => "memo-token");
    let unusable = true;
    const fetcher = vi.fn(async () => (unusable ? undefined : 20));
    const state = new ClaudeQuotaState(fetcher, () => 0, 1000, 500, readToken);
    state.startPolling();
    await vi.advanceTimersByTimeAsync(0);
    expect(readToken).toHaveBeenCalledTimes(1);
    unusable = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(readToken).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(state.usedPercent).toBe(20));
    state.stopPolling();
    vi.useRealTimers();
  });

  it("skips the request entirely when no token can be resolved", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => 5);
    const state = new ClaudeQuotaState(fetcher, () => 0, 1000, 500, () => undefined);
    state.startPolling();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher).not.toHaveBeenCalled();
    state.stopPolling();
    vi.useRealTimers();
  });
});
