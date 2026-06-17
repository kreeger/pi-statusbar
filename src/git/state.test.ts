import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitState } from "./state.js";
import { createEmptyGitStatus } from "./reader.js";
import type { GitStatusSnapshot } from "../types.js";

let tempDir: string;

function createMockPi(returnStatus?: Record<string, unknown>) {
  return {
    exec: vi.fn(() =>
      Promise.resolve({
        code: 0,
        stdout: returnStatus?.stdout ?? "## main\n?? file.txt",
      }),
    ),
  } as any;
}

function makeDir(): string {
  tempDir = mkdtempSync(join(tmpdir(), "pi-statusbar-git-state-"));
  return tempDir;
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe("GitState", () => {
  it("loads cached git status on construction", () => {
    const dir = makeDir();
    const cachePath = join(dir, "git-status.json");
    writeFileSync(
      cachePath,
      JSON.stringify({
        branch: "cached-branch",
        added: 0,
        modified: 0,
        deleted: 0,
        untracked: 0,
        ahead: 0,
        behind: 0,
      }),
      "utf8",
    );

    const pi = createMockPi();
    const state = new GitState(pi, "/repo", dir);
    expect(state.snapshot.branch).toBe("cached-branch");
  });

  it("returns empty status when no cache exists", () => {
    const dir = makeDir();
    const pi = createMockPi();
    const state = new GitState(pi, "/repo", dir);
    expect(state.snapshot).toEqual(createEmptyGitStatus());
  });

  it("handles corrupt cache gracefully", () => {
    const dir = makeDir();
    writeFileSync(join(dir, "git-status.json"), "not json", "utf8");
    const pi = createMockPi();
    const state = new GitState(pi, "/repo", dir);
    expect(state.snapshot).toEqual(createEmptyGitStatus());
  });

  it("round-trips save via poll", async () => {
    const dir = makeDir();
    const pi = createMockPi({
      stdout: "## feature\n M modified.ts",
    });
    const state = new GitState(pi, "/repo", dir);
    state.startPolling();

    await vi.waitFor(() => {
      expect(state.snapshot.branch).toBe("feature");
    });
    state.stopPolling();

    // Verify cache was persisted
    const state2 = new GitState(createMockPi(), "/repo", dir);
    expect(state2.snapshot.branch).toBe("feature");
  });

  it("startPolling reads git status", async () => {
    const dir = makeDir();
    const pi = createMockPi({
      stdout: "## main\n M modified.ts",
    });
    const state = new GitState(pi, "/repo", dir);
    state.startPolling();

    await vi.waitFor(() => {
      expect(state.snapshot.branch).toBe("main");
    });
    state.stopPolling();
  });

  it("stopPolling is safe to call multiple times", () => {
    const dir = makeDir();
    const pi = createMockPi();
    const state = new GitState(pi, "/repo", dir);
    state.stopPolling();
    state.stopPolling();
  });
});