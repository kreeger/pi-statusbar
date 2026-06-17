import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { GitStatusSnapshot } from "../types.js";

export function createEmptyGitStatus(): GitStatusSnapshot {
  return {
    branch: null,
    added: 0,
    modified: 0,
    deleted: 0,
    untracked: 0,
    ahead: 0,
    behind: 0,
  };
}

export function parseGitStatus(output: string): GitStatusSnapshot {
  const status = createEmptyGitStatus();

  for (const line of output.split("\n")) {
    if (line.startsWith("## ")) {
      const branchInfo = line.slice(3);
      const parts = branchInfo.split("...");
      status.branch = parts[0]?.trim() || null;

      // Parse ahead/behind, e.g. "[ahead 2, behind 1]" or "[behind 4]"
      const behindOnly = branchInfo.match(/\[behind\s+(\d+)\]/);
      if (behindOnly) {
        status.behind = parseInt(behindOnly[1], 10);
      }
      const bracketMatch = branchInfo.match(
        /\[ahead\s+(\d+)(?:[,\s]+behind\s+(\d+))?\]/,
      );
      if (bracketMatch) {
        status.ahead = parseInt(bracketMatch[1] ?? "0", 10);
        status.behind = parseInt(bracketMatch[2] ?? "0", 10);
      }
      continue;
    }

    if (line.startsWith("??")) {
      status.untracked++;
      continue;
    }

    // Normal porcelain lines: XY <path>
    const index = line[0];
    const worktree = line[1];
    if (index !== " " && index !== "?" && index !== "!" && index !== "#") {
      if (index === "A" || index === "M" || index === "D") {
        if (index === "A") status.added++;
        if (index === "M") status.modified++;
        if (index === "D") status.deleted++;
      }
    }
    if (worktree !== " " && worktree !== "?") {
      if (worktree === "A") status.added++;
      if (worktree === "M") status.modified++;
      if (worktree === "D") status.deleted++;
    }
    // No handling needed for " " (space) — that means unchanged in that tree
  }

  return status;
}

export async function readGitStatus(
  pi: ExtensionAPI,
  cwd: string,
  signal?: AbortSignal,
): Promise<GitStatusSnapshot> {
  const result = await pi.exec(
    "git",
    ["status", "--porcelain=v1", "--branch"],
    { cwd, signal, timeout: 5000 },
  );
  if (result.code !== 0) return createEmptyGitStatus();
  return parseGitStatus(result.stdout);
}