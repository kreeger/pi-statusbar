import { describe, expect, it, vi } from "vitest";
import extension from "./index.js";

function createMockPi() {
  const handlers: Record<string, Function[]> = {};
  return {
    handlers,
    exec: vi.fn(() =>
      Promise.resolve({ code: 0, stdout: "## main\n?? file.txt" }),
    ),
    getThinkingLevel: vi.fn(() => "off"),
    on: vi.fn((event: string, handler: Function) => {
      handlers[event] ??= [];
      handlers[event].push(handler);
    }),
  } as any;
}

describe("pi-statusbar extension", () => {
  it("registers session lifecycle handlers", () => {
    const pi = createMockPi();
    extension(pi);

    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith(
      "session_shutdown",
      expect.any(Function),
    );
  });

  it("sets a footer when UI is available", async () => {
    const pi = createMockPi();
    extension(pi);

    const ctx = {
      hasUI: true,
      cwd: "/repo",
      model: { provider: "test", id: "model" },
      getContextUsage: vi.fn(() => undefined),
      sessionManager: { getBranch: vi.fn(() => []) },
      ui: { setFooter: vi.fn() },
    };

    await pi.handlers.session_start[0]({}, ctx);

    expect(ctx.ui.setFooter).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not set a footer without UI", async () => {
    const pi = createMockPi();
    extension(pi);

    const ctx = { hasUI: false, ui: { setFooter: vi.fn() } };
    await pi.handlers.session_start[0]({}, ctx);

    expect(ctx.ui.setFooter).not.toHaveBeenCalled();
  });
});