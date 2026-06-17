import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createEmptyGitStatus, readGitStatus } from "./reader.js";
import type { GitStatusSnapshot } from "../types.js";

const DEFAULT_POLL_INTERVAL_MS = 2000;

function loadCache(path: string): GitStatusSnapshot {
  try {
    if (!existsSync(path)) return createEmptyGitStatus();
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!raw || typeof raw !== "object") return createEmptyGitStatus();
    return {
      branch: typeof raw.branch === "string" ? raw.branch : null,
      added: typeof raw.added === "number" ? raw.added : 0,
      modified: typeof raw.modified === "number" ? raw.modified : 0,
      deleted: typeof raw.deleted === "number" ? raw.deleted : 0,
      untracked: typeof raw.untracked === "number" ? raw.untracked : 0,
      ahead: typeof raw.ahead === "number" ? raw.ahead : 0,
      behind: typeof raw.behind === "number" ? raw.behind : 0,
    };
  } catch {
    return createEmptyGitStatus();
  }
}

function saveCache(path: string, status: GitStatusSnapshot): void {
  try {
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, JSON.stringify(status), "utf8");
  } catch {
    // Graceful failure — cache is best-effort
  }
}

/**
 * GitState owns the current git snapshot and manages polling lifecycle.
 * Polling fires immediately on start, then at the configured interval.
 * Each result updates the snapshot and persists it to a scratch file for
 * cross-session continuity.
 */
export class GitState {
  private _snapshot: GitStatusSnapshot;
  private _intervalId: ReturnType<typeof setInterval> | undefined;
  private _pi: ExtensionAPI;
  private _cwd: string;
  private _cacheFilePath: string;

  constructor(pi: ExtensionAPI, cwd: string, cacheDir?: string) {
    this._pi = pi;
    this._cwd = cwd;
    this._cacheFilePath = join(
      cacheDir ?? join(process.env.XDG_RUNTIME_DIR ?? "/tmp", "pi-statusbar"),
      "git-status.json",
    );
    this._snapshot = loadCache(this._cacheFilePath);
  }

  get snapshot(): GitStatusSnapshot {
    return this._snapshot;
  }

  get isPolling(): boolean {
    return this._intervalId !== undefined;
  }

  startPolling(): void {
    void this.pollOnce();
    this._intervalId = setInterval(() => {
      void this.pollOnce();
    }, DEFAULT_POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this._intervalId !== undefined) {
      clearInterval(this._intervalId);
      this._intervalId = undefined;
    }
  }

  private async pollOnce(): Promise<void> {
    try {
      const snapshot = await readGitStatus(this._pi, this._cwd);
      this._snapshot = snapshot;
      saveCache(this._cacheFilePath, snapshot);
    } catch {
      this._snapshot = createEmptyGitStatus();
    }
  }
}