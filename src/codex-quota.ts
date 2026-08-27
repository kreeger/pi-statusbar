import { spawn } from "node:child_process";

const DEFAULT_POLL_INTERVAL_MS = 300_000;
const DEFAULT_STALE_TTL_MS = 600_000;
const REQUEST_TIMEOUT_MS = 10_000;

export function parseUsedPercent(raw: unknown): number | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const rateLimits = (raw as {
    rateLimits?: {
      primary?: { usedPercent?: unknown } | null;
      individualLimit?: { remainingPercent?: unknown } | null;
    };
  }).rateLimits;
  const primary = rateLimits?.primary?.usedPercent;
  const remaining = rateLimits?.individualLimit?.remainingPercent;
  const value = primary ?? (typeof remaining === "number" ? 100 - remaining : undefined);
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100
    ? value
    : undefined;
}

function readCodexUsage(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    let buffer = "";
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const finish = (callback: (value: unknown) => void, value: unknown) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      child.kill();
      callback(value);
    };
    const send = (id: number, method: string, params: object) => {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      let lineEnd: number;
      while ((lineEnd = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 1);
        try {
          const message = JSON.parse(line) as {
            id?: number;
            result?: unknown;
            error?: { message?: string };
          };
          if (message.id === 1) {
            send(2, "account/rateLimits/read", {});
          } else if (message.id === 2) {
            if (message.error) {
              finish(reject, new Error(message.error.message ?? "Codex usage request failed"));
            } else {
              finish(resolve, message.result);
            }
          }
        } catch {
          // Ignore non-JSON app-server output.
        }
      }
    });
    child.on("error", (error) => finish(reject, error));
    child.on("exit", () => {
      if (!settled) finish(reject, new Error("Codex app-server exited before responding"));
    });

    send(1, "initialize", {
      clientInfo: { name: "pi-statusbar", version: "0.2.0" },
      capabilities: {},
    });
    timeout = setTimeout(
      () => finish(reject, new Error("Codex usage request timed out")),
      REQUEST_TIMEOUT_MS,
    );
  });
}

export async function fetchCodexUsedPercent(
  readUsage: () => Promise<unknown> = readCodexUsage,
): Promise<number | undefined> {
  try {
    return parseUsedPercent(await readUsage());
  } catch {
    return undefined;
  }
}

export class CodexQuotaState {
  private value: number | undefined;
  private updatedAt = 0;
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private inFlight = false;

  constructor(
    private readonly fetcher: () => Promise<number | undefined> = () => fetchCodexUsedPercent(),
    private readonly now: () => number = Date.now,
    private readonly pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    private readonly staleTtlMs = DEFAULT_STALE_TTL_MS,
  ) {}

  get usedPercent(): number | undefined {
    return this.value !== undefined && this.now() - this.updatedAt <= this.staleTtlMs
      ? this.value
      : undefined;
  }

  startPolling(onComplete: () => void = () => {}): void {
    if (this.intervalId) return;
    void this.pollOnce(onComplete);
    this.intervalId = setInterval(() => void this.pollOnce(onComplete), this.pollIntervalMs);
  }

  stopPolling(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = undefined;
  }

  get isPolling(): boolean { return this.intervalId !== undefined; }

  private async pollOnce(onComplete: () => void): Promise<void> {
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
      onComplete();
    }
  }
}
