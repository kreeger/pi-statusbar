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

function mockQuotaState() {
  return {
    usedPercent: undefined,
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    isPolling: false,
  } as any;
}

describe("pi-statusbar extension", () => {
  it("does not perform quota requests in lifecycle tests", async () => {
    const stopPolling = vi.fn();
    const pi = createMockPi();
    extension(
      pi,
      () =>
        ({
          usedPercent: undefined,
          startPolling: vi.fn(),
          stopPolling,
          isPolling: false,
        }) as any,
    );
    const ctx = {
      hasUI: true,
      cwd: "/repo",
      getContextUsage: vi.fn(() => undefined),
      sessionManager: { getBranch: vi.fn(() => []) },
      ui: { setFooter: vi.fn() },
    };
    await pi.handlers.session_start[0]({}, ctx);
    pi.handlers.session_shutdown[0]({}, ctx);
    expect(stopPolling).toHaveBeenCalled();
  });
  it("registers session lifecycle handlers", () => {
    const pi = createMockPi();
    extension(pi, mockQuotaState);

    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith(
      "session_shutdown",
      expect.any(Function),
    );
  });

  it("sets a footer when UI is available", async () => {
    const pi = createMockPi();
    extension(pi, mockQuotaState);

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

  it("does not render a cleared git state during shutdown", async () => {
    const pi = createMockPi();
    extension(pi, mockQuotaState);

    const ctx = {
      hasUI: true,
      cwd: "/repo",
      getContextUsage: vi.fn(() => undefined),
      sessionManager: { getBranch: vi.fn(() => []) },
      ui: { setFooter: vi.fn() },
    };

    await pi.handlers.session_start[0]({}, ctx);
    const footer = ctx.ui.setFooter.mock.calls[0][0]();

    pi.handlers.session_shutdown[0]({}, ctx);

    expect(() => footer.render(120)).not.toThrow();
  });

  it("clears the footer during shutdown", async () => {
    const pi = createMockPi();
    extension(pi, mockQuotaState);

    const ctx = {
      hasUI: true,
      cwd: "/repo",
      getContextUsage: vi.fn(() => undefined),
      sessionManager: { getBranch: vi.fn(() => []) },
      ui: { setFooter: vi.fn() },
    };

    await pi.handlers.session_start[0]({}, ctx);
    pi.handlers.session_shutdown[0]({}, ctx);

    expect(ctx.ui.setFooter).toHaveBeenLastCalledWith(undefined);
  });

  it("does not set a footer without UI", async () => {
    const pi = createMockPi();
    extension(pi, mockQuotaState);

    const ctx = { hasUI: false, ui: { setFooter: vi.fn() } };
    await pi.handlers.session_start[0]({}, ctx);

    expect(ctx.ui.setFooter).not.toHaveBeenCalled();
  });
});
