import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CLAUDE_USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const DEFAULT_POLL_INTERVAL_MS = 300_000;
const DEFAULT_STALE_TTL_MS = 600_000;
const REQUEST_TIMEOUT_MS = 10_000;

function extractAccessToken(raw: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    const token = (parsed as { claudeAiOauth?: { accessToken?: unknown } }).claudeAiOauth
      ?.accessToken;
    return typeof token === "string" && token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
}

function readKeychainCredentials(): string | undefined {
  if (process.platform !== "darwin") return undefined;
  try {
    return execFileSync(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { encoding: "utf8", timeout: REQUEST_TIMEOUT_MS },
    );
  } catch {
    return undefined;
  }
}

export function parseSpendPercent(raw: unknown): number | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const spend = (raw as { spend?: { enabled?: unknown; percent?: unknown } }).spend;
  if (!spend || spend.enabled !== true) return undefined;
  const value = spend.percent;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100
    ? value
    : undefined;
}

export function readClaudeAccessToken(
  readKeychain: () => string | undefined = readKeychainCredentials,
  path = join(homedir(), ".claude", ".credentials.json"),
): string | undefined {
  let keychainRaw: string | undefined;
  try {
    keychainRaw = readKeychain();
  } catch {
    keychainRaw = undefined;
  }
  const keychainToken = extractAccessToken(keychainRaw ?? "");
  if (keychainToken) return keychainToken;
  try {
    return extractAccessToken(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

export async function fetchClaudeUsedPercent(
  fetchFn: typeof fetch = fetch,
  readKeychain?: () => string | undefined,
  authPath?: string,
): Promise<number | undefined> {
  const token = readClaudeAccessToken(readKeychain, authPath);
  if (!token) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchFn(CLAUDE_USAGE_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "anthropic-beta": "oauth-2025-04-20",
      },
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    return parseSpendPercent(await response.json());
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export class ClaudeQuotaState {
  private value: number | undefined;
  private updatedAt = 0;
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private inFlight = false;

  constructor(
    private readonly fetcher: () => Promise<number | undefined> = () => fetchClaudeUsedPercent(),
    private readonly now: () => number = Date.now,
    private readonly pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    private readonly staleTtlMs = DEFAULT_STALE_TTL_MS,
  ) {}

  get usedPercent(): number | undefined {
    return this.value !== undefined && this.now() - this.updatedAt <= this.staleTtlMs
      ? this.value
      : undefined;
  }

  startPolling(): void {
    if (this.intervalId) return;
    void this.pollOnce();
    this.intervalId = setInterval(() => void this.pollOnce(), this.pollIntervalMs);
  }

  stopPolling(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = undefined;
  }

  get isPolling(): boolean { return this.intervalId !== undefined; }

  private async pollOnce(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const next = await this.fetcher();
      if (next !== undefined) {
        this.value = next;
        this.updatedAt = this.now();
      }
    } finally {
      this.inFlight = false;
    }
  }
}
